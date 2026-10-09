import time
import logging
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np

logger = logging.getLogger("faceattend.liveness")

class LivenessService:
    """
    Multi-layer Anti-Spoofing and Active Eye-Blink Verification Service.
    Prevents attendance fraud using printed photos, mobile phone screens, or digital replays.
    Requires a genuine live student to blink naturally before attendance is recorded.
    """
    def __init__(self):
        # In-memory tracking per studentId / face: { student_id: tracker_state }
        self._trackers: Dict[str, Dict[str, Any]] = {}
        self.cleanup_interval = 60.0
        self._last_cleanup = time.time()

    def _cleanup_old_trackers(self):
        now = time.time()
        if now - self._last_cleanup < self.cleanup_interval:
            return
        expired = [sid for sid, data in self._trackers.items() if (now - data.get('last_seen', 0)) > 45.0]
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
        Only flags screen glare if specular reflection exceeds high threshold.
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

        # Phone screen glare typically covers > 12% of the crop
        is_glare_spoof = glare_ratio > 0.12

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
                'eye_state': eye_state.lower(),
                'eye_openness': openness,
                'is_spoof': True,
                'spoof_reason': 'screen_glare',
                'prompt': 'Screen reflection detected! Live student face required (Digital screen not allowed).',
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
                'blink_verified': False,
                'verified_at': 0.0,
            }

        tracker = self._trackers[track_key]
        tracker['last_seen'] = now

        # If already verified in the last 15 seconds, maintain verified status
        if tracker['blink_verified'] and (now - tracker.get('verified_at', 0)) < 15.0:
            return {
                'is_live': True,
                'liveness_status': 'verified',
                'eye_state': 'verified',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': 'Live student verified! (Eye blink confirmed)',
                'blink_verified': True
            }
        elif tracker['blink_verified'] and (now - tracker.get('verified_at', 0)) >= 15.0:
            # Expire verification so student blinks next time
            tracker['blink_verified'] = False
            tracker['history'] = []

        # Add current frame to history
        tracker['history'].append({
            'time': now,
            'openness': openness,
            'state': eye_state,
            'bbox': bbox
        })

        if len(tracker['history']) > 15:
            tracker['history'].pop(0)

        # Check Dynamic Blink Dip:
        # A live eye blink consists of: baseline open -> dip (eyelids close) -> reopen
        if len(tracker['history']) >= 3 and not tracker['blink_verified']:
            scores = [h['openness'] for h in tracker['history']]
            baseline_open = float(np.percentile(scores, 75))
            min_val = float(np.min(scores))
            min_idx = int(np.argmin(scores))
            latest = float(scores[-1])
            dip_amount = baseline_open - min_val

            # Sensitive yet rock-solid anti-spoof:
            # Detects any dynamic dip >= 0.05 OR absolute closure <= 0.32
            has_dip = (dip_amount >= 0.05) or (min_val <= 0.32 and baseline_open >= 0.36)
            reopened = (latest >= baseline_open * 0.75) and (min_idx < len(scores) - 1)

            if has_dip and reopened:
                tracker['blink_verified'] = True
                tracker['verified_at'] = now
                logger.info(f"Live eye blink confirmed for tracker {track_key} (dip: {dip_amount:.2f}, baseline: {baseline_open:.2f})!")

        # State-machine fallback: saw OPEN -> saw CLOSED/TRANSITION -> saw OPEN
        if not tracker['blink_verified'] and len(tracker['history']) >= 3:
            hist_states = [h['state'] for h in tracker['history']]
            has_open_start = False
            has_closed = False
            reopened = False
            for s in hist_states:
                if s == 'OPEN' and not has_closed:
                    has_open_start = True
                elif (s == 'CLOSED' or s == 'TRANSITION') and has_open_start:
                    has_closed = True
                elif s == 'OPEN' and has_closed:
                    reopened = True

            if reopened:
                tracker['blink_verified'] = True
                tracker['verified_at'] = now
                logger.info(f"Live eye blink confirmed via state machine for {track_key}!")

        # Return live status
        if tracker['blink_verified']:
            return {
                'is_live': True,
                'liveness_status': 'verified',
                'eye_state': 'verified',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': 'Live student verified! (Eye blink confirmed)',
                'blink_verified': True
            }

        if eye_state == 'CLOSED' or (len(tracker['history']) >= 2 and openness <= 0.32):
            return {
                'is_live': False,
                'liveness_status': 'blinking',
                'eye_state': 'closing',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': 'Blink detected! Re-opening eyes...',
                'blink_verified': False
            }
        else:
            return {
                'is_live': False,
                'liveness_status': 'awaiting_blink',
                'eye_state': 'open',
                'eye_openness': openness,
                'is_spoof': False,
                'spoof_reason': None,
                'prompt': 'Please blink your eyes naturally to mark attendance (Live Check)',
                'blink_verified': False
            }

liveness_service = LivenessService()
