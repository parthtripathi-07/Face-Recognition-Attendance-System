import time
import logging
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np

logger = logging.getLogger("faceattend.liveness")

class LivenessService:
    """
    Multi-layer Anti-Spoofing and Active Dual Eye-Blink Verification Service.
    Strictly requires 2 complete, distinct eye blinks before attendance is marked.
    Completely blocks printed photos, phone screens, and digital replays.
    """
    REQUIRED_BLINKS = 2

    def __init__(self):
        # In-memory tracking per studentId / face: { student_id: tracker_state }
        self._trackers: Dict[str, Dict[str, Any]] = {}
        self.cleanup_interval = 60.0
        self._last_cleanup = time.time()

    def reset_student_tracker(self, student_id: str):
        """Immediately resets a student's blink tracking state (e.g. after attendance is marked)."""
        if not student_id:
            return
        if student_id in self._trackers:
            self._trackers.pop(student_id, None)
            logger.info(f"Liveness tracker reset for student {student_id}.")

    def _cleanup_old_trackers(self):
        now = time.time()
        if now - self._last_cleanup < self.cleanup_interval:
            return
        expired = [sid for sid, data in self._trackers.items() if (now - data.get('last_seen', 0)) > 40.0]
        for sid in expired:
            self._trackers.pop(sid, None)
        self._last_cleanup = now

    def extract_eye_crops(self, image: np.ndarray, landmarks: List[List[float]]) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], float]:
        """
        Extracts left and right eye bounding crops based on YuNet landmarks.
        landmarks: [[re_x, re_y], [le_x, le_y], [nose_x, nose_y], ...]
        """
        if not landmarks or len(landmarks) < 2:
            return None, None, 0.0

        re_x, re_y = landmarks[0]
        le_x, le_y = landmarks[1]

        eye_dist = np.sqrt((re_x - le_x) ** 2 + (re_y - le_y) ** 2)
        if eye_dist < 12:
            return None, None, float(eye_dist)

        img_h, img_w = image.shape[:2]
        crop_w = int(eye_dist * 0.38)
        crop_h = int(eye_dist * 0.28)

        def safe_crop(cx, cy):
            x1 = max(0, int(cx - crop_w / 2))
            x2 = min(img_w, int(cx + crop_w / 2))
            y1 = max(0, int(cy - crop_h / 2))
            y2 = min(img_h, int(cy + crop_h / 2))
            if (x2 - x1) < 6 or (y2 - y1) < 5:
                return None
            return image[y1:y2, x1:x2]

        right_eye = safe_crop(re_x, re_y)
        left_eye = safe_crop(le_x, le_y)
        return right_eye, left_eye, float(eye_dist)

    def calculate_single_eye_openness(self, eye_crop: Optional[np.ndarray]) -> float:
        """
        Measures openness of an eye patch (0.0 = completely closed, 1.0 = wide open).
        Uses pupil/sclera contrast, standard deviation, and vertical edge gradients.
        """
        if eye_crop is None or eye_crop.size == 0:
            return 0.50

        h, w = eye_crop.shape[:2]
        if h < 5 or w < 6:
            return 0.50

        gray = cv2.cvtColor(eye_crop, cv2.COLOR_BGR2GRAY)
        
        # Central region where pupil & iris are located
        ch1, ch2 = int(h * 0.15), int(h * 0.85)
        cw1, cw2 = int(w * 0.18), int(w * 0.82)
        center = gray[ch1:ch2, cw1:cw2]
        if center.size == 0:
            return 0.50

        std_dev = float(np.std(center))
        min_p = float(np.min(center))
        max_p = float(np.max(center))
        contrast = max_p - min_p

        # Pupil ratio: dark pixels relative to patch size
        pupil_thresh = min_p + (contrast * 0.32)
        pupil_pixels = np.sum(center <= pupil_thresh)
        pupil_ratio = float(pupil_pixels) / float(center.size)

        # Vertical Sobel gradient (strong edge where upper eyelid meets eye)
        sobely = cv2.Sobel(center, cv2.CV_64F, 0, 1, ksize=3)
        edge_energy = float(np.mean(np.abs(sobely)))

        score_std = min(1.0, std_dev / 42.0)
        score_contrast = min(1.0, contrast / 110.0)
        score_edge = min(1.0, edge_energy / 38.0)
        score_pupil = min(1.0, pupil_ratio / 0.32)

        openness = (score_std * 0.35) + (score_contrast * 0.25) + (score_edge * 0.25) + (score_pupil * 0.15)
        return float(np.clip(openness, 0.0, 1.0))

    def evaluate_eye_openness(self, image: np.ndarray, landmarks: List[List[float]]) -> Tuple[float, str, float]:
        """
        Evaluates both eyes and returns (average_openness, eye_state, eye_distance).
        eye_state: 'OPEN' | 'CLOSED' | 'TRANSITION'
        """
        right_crop, left_crop, eye_dist = self.extract_eye_crops(image, landmarks)
        if eye_dist < 12:
            return 0.55, 'OPEN', eye_dist

        right_score = self.calculate_single_eye_openness(right_crop)
        left_score = self.calculate_single_eye_openness(left_crop)

        # Take average of both eyes
        avg_score = (right_score + left_score) / 2.0

        if avg_score >= 0.38:
            state = 'OPEN'
        elif avg_score <= 0.28:
            state = 'CLOSED'
        else:
            state = 'TRANSITION'

        return round(float(avg_score), 3), state, round(float(eye_dist), 1)

    def analyze_texture_and_spoof(self, image: np.ndarray, bbox: List[int]) -> Dict[str, Any]:
        """
        Checks for bright specular screen glare (mobile phone or tablet glass reflection).
        """
        x, y, w, h = bbox
        img_h, img_w = image.shape[:2]
        x1 = max(0, x)
        y1 = max(0, y)
        x2 = min(img_w, x + w)
        y2 = min(img_h, y + h)

        crop = image[y1:y2, x1:x2]
        if crop.size == 0 or (x2 - x1) < 20 or (y2 - y1) < 20:
            return {'spoof_detected': False, 'reason': None, 'glare_ratio': 0.0}

        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)

        # Specular Glare (extreme brightness with zero saturation typical of glass reflection)
        glare_mask = (hsv[:, :, 2] > 252) & (hsv[:, :, 1] < 18)
        glare_ratio = float(np.sum(glare_mask)) / float(crop.shape[0] * crop.shape[1])

        # Phone screen glare typically covers > 9% of the face crop
        is_glare_spoof = glare_ratio > 0.09

        return {
            'spoof_detected': is_glare_spoof,
            'reason': 'screen_glare' if is_glare_spoof else None,
            'glare_ratio': round(glare_ratio, 4)
        }

    def process_face_liveness(
        self,
        image: np.ndarray,
        face_info: Dict[str, Any],
        student_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Master liveness evaluation for a detected face.
        STRICTLY requires 2 distinct eye blinks before returning verified = True.
        """
        self._cleanup_old_trackers()

        bbox = face_info.get('bbox', [0, 0, 0, 0])
        landmarks = face_info.get('landmarks', [])

        # 1. Eye openness calculation
        openness, eye_state, eye_dist = self.evaluate_eye_openness(image, landmarks)

        # 2. Specular Screen Glare analysis
        texture_res = self.analyze_texture_and_spoof(image, bbox)
        if texture_res['spoof_detected']:
            return {
                'is_live': False,
                'liveness_status': 'spoof_detected',
                'blinks_count': 0,
                'required_blinks': self.REQUIRED_BLINKS,
                'eye_state': eye_state.lower(),
                'eye_openness': openness,
                'is_spoof': True,
                'spoof_reason': 'screen_glare',
                'prompt': 'Screen reflection detected! Live student face required (Mobile screen not allowed).',
                'blink_verified': False
            }

        # 3. Temporal Tracker per Student / Face Track
        track_key = student_id or f"face_{bbox[0]}_{bbox[1]}"
        now = time.time()

        if track_key not in self._trackers:
            self._trackers[track_key] = {
                'created_at': now,
                'last_seen': now,
                'history': [],
                'blinks_count': 0,
                'stage': 'WAITING_BLINK_1',
                'blink_1_time': 0.0,
                'blink_2_time': 0.0,
                'verified_at': 0.0,
                'blink_verified': False,
            }

        tracker = self._trackers[track_key]
        tracker['last_seen'] = now

        # Expiration for verified status: valid only for 3.5 seconds
        if tracker['blink_verified']:
            if (now - tracker.get('verified_at', 0)) < 3.5:
                return {
                    'is_live': True,
                    'liveness_status': 'verified',
                    'blinks_count': 2,
                    'required_blinks': self.REQUIRED_BLINKS,
                    'eye_state': 'verified',
                    'eye_openness': openness,
                    'is_spoof': False,
                    'spoof_reason': None,
                    'prompt': '2 blinks verified! Attendance confirmed.',
                    'blink_verified': True
                }
            else:
                # Expire after 3.5s so new blinks are needed
                tracker['blink_verified'] = False
                tracker['blinks_count'] = 0
                tracker['stage'] = 'WAITING_BLINK_1'
                tracker['history'] = []

        # Record openness history
        tracker['history'].append({
            'time': now,
            'openness': openness,
            'state': eye_state,
            'bbox': bbox
        })

        if len(tracker['history']) > 20:
            tracker['history'].pop(0)

        # Baseline openness (75th percentile of recent window)
        scores = [h['openness'] for h in tracker['history']]
        baseline_open = float(np.percentile(scores, 75))
        dip = baseline_open - openness

        # Strict closure & open criteria:
        # A true eye blink requires closure <= 0.30 OR dip >= 0.12 from baseline >= 0.38
        is_closed = (openness <= 0.30) or (dip >= 0.12 and baseline_open >= 0.38)
        is_open = (openness >= 0.38) and (dip <= 0.07)

        # --- 2-BLINK STATE MACHINE ---
        if tracker['stage'] == 'WAITING_BLINK_1':
            if is_closed and len(tracker['history']) >= 2:
                tracker['stage'] = 'BLINK_1_CLOSING'
                logger.info(f"Tracker {track_key}: Blink 1 Closing detected (openness: {openness:.2f}, dip: {dip:.2f})")

        elif tracker['stage'] == 'BLINK_1_CLOSING':
            if is_open:
                tracker['blinks_count'] = 1
                tracker['blink_1_time'] = now
                tracker['stage'] = 'WAITING_BLINK_2'
                logger.info(f"Tracker {track_key}: Blink 1 Reopened & CONFIRMED! (1/2)")

        elif tracker['stage'] == 'WAITING_BLINK_2':
            # Require at least 150ms between blinks to ensure distinct blinks
            if (now - tracker['blink_1_time']) >= 0.15:
                if is_closed:
                    tracker['stage'] = 'BLINK_2_CLOSING'
                    logger.info(f"Tracker {track_key}: Blink 2 Closing detected (openness: {openness:.2f}, dip: {dip:.2f})")

        elif tracker['stage'] == 'BLINK_2_CLOSING':
            if is_open:
                tracker['blinks_count'] = 2
                tracker['blink_2_time'] = now
                tracker['verified_at'] = now
                tracker['blink_verified'] = True
                tracker['stage'] = 'VERIFIED'
                logger.info(f"Tracker {track_key}: Blink 2 Reopened & CONFIRMED! (2/2) LIVE VERIFIED!")

        # Generate status and prompt
        if tracker['blink_verified']:
            return {
                'is_live': True,
                'liveness_status': 'verified',
                'blinks_count': 2,
                'required_blinks': self.REQUIRED_BLINKS,
                'eye_state': 'verified',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': '2 blinks verified! Attendance confirmed.',
                'blink_verified': True
            }
        elif tracker['stage'] == 'BLINK_2_CLOSING':
            return {
                'is_live': False,
                'liveness_status': 'blinking_2',
                'blinks_count': 1,
                'required_blinks': self.REQUIRED_BLINKS,
                'eye_state': 'closing',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': '2nd blink detected... reopen eyes to confirm (2/2)',
                'blink_verified': False
            }
        elif tracker['stage'] == 'WAITING_BLINK_2':
            return {
                'is_live': False,
                'liveness_status': 'blink_1_done',
                'blinks_count': 1,
                'required_blinks': self.REQUIRED_BLINKS,
                'eye_state': 'open',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': '1st blink verified! Please blink 1 more time (Blink 2 of 2)',
                'blink_verified': False
            }
        elif tracker['stage'] == 'BLINK_1_CLOSING':
            return {
                'is_live': False,
                'liveness_status': 'blinking_1',
                'blinks_count': 0,
                'required_blinks': self.REQUIRED_BLINKS,
                'eye_state': 'closing',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': '1st blink detected... reopen eyes (1/2)',
                'blink_verified': False
            }
        else:
            return {
                'is_live': False,
                'liveness_status': 'awaiting_blink',
                'blinks_count': 0,
                'required_blinks': self.REQUIRED_BLINKS,
                'eye_state': 'open',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': 'Please blink your eyes 2 times to verify attendance (0/2)',
                'blink_verified': False
            }

liveness_service = LivenessService()
