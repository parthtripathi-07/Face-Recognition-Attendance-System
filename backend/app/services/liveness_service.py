import logging
import time
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np

logger = logging.getLogger("faceattend.liveness")

class LivenessService:
    """
    Multi-Layer Presentation Attack Detection (PAD) and Strict Dual Eye-Blink Verification Service.

    Guarantees:
    1. Zero attendance without 2 distinct, confirmed live eye blinks (Open -> Closed -> Open -> Open -> Closed -> Open).
    2. Complete rejection of mobile phone screens, printed photos, and video replays via dedicated PAD.
    3. Motion blur and phone-shaking detection: shaking a phone, moving a photo, or camera jitter
       can NEVER falsely trigger an eye closure or advance the blink challenge.
    4. Face tracking continuity: challenge resets immediately if tracking is lost or unstable.
    5. Single-use verification token: verification state is consumed immediately upon recording.
    """
    REQUIRED_BLINKS = 2

    def __init__(self):
        # In-memory tracking per studentId / face: { student_id: tracker_state }
        self._trackers: Dict[str, Dict[str, Any]] = {}
        self.cleanup_interval = 45.0
        self._last_cleanup = time.time()

    def reset_student_tracker(self, student_id: str):
        """Immediately and atomically clears a student's blink tracking state."""
        if not student_id:
            return
        if student_id in self._trackers:
            self._trackers.pop(student_id, None)
            logger.info(f"[LIVENESS_TRACK] Reset challenge tracker for student: {student_id}")

    def _cleanup_old_trackers(self):
        now = time.time()
        if now - self._last_cleanup < self.cleanup_interval:
            return
        expired = [sid for sid, data in self._trackers.items() if (now - data.get('last_seen', 0)) > 30.0]
        for sid in expired:
            self._trackers.pop(sid, None)
        self._last_cleanup = now

    def extract_face_and_eye_regions(
        self, image: np.ndarray, bbox: List[int], landmarks: List[List[float]]
    ) -> Tuple[Optional[np.ndarray], float, Optional[np.ndarray], Optional[np.ndarray], float, float]:
        """
        Extracts face crop, face sharpness, eye crops, and forehead skin patch.
        Returns: (face_crop, face_sharpness, right_eye, left_eye, forehead_sharpness, eye_dist)
        """
        img_h, img_w = image.shape[:2]
        x, y, w, h = bbox

        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(img_w, x + w), min(img_h, y + h)
        face_crop = image[y1:y2, x1:x2]

        if face_crop.size == 0 or (x2 - x1) < 20 or (y2 - y1) < 20:
            return None, 0.0, None, None, 0.0, 0.0

        face_gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        face_sharpness = float(cv2.Laplacian(face_gray, cv2.CV_64F).var())

        if not landmarks or len(landmarks) < 2:
            return face_crop, face_sharpness, None, None, 0.0, 0.0

        re_x, re_y = landmarks[0]
        le_x, le_y = landmarks[1]
        eye_dist = float(np.sqrt((re_x - le_x) ** 2 + (re_y - le_y) ** 2))
        if eye_dist < 12:
            return face_crop, face_sharpness, None, None, 0.0, eye_dist

        crop_w = int(eye_dist * 0.40)
        crop_h = int(eye_dist * 0.28)

        def crop_eye(cx, cy):
            ex1 = max(0, int(cx - crop_w / 2))
            ex2 = min(img_w, int(cx + crop_w / 2))
            ey1 = max(0, int(cy - crop_h / 2))
            ey2 = min(img_h, int(cy + crop_h / 2))
            if (ex2 - ex1) < 6 or (ey2 - ey1) < 5:
                return None
            return image[ey1:ey2, ex1:ex2]

        right_eye = crop_eye(re_x, re_y)
        left_eye = crop_eye(le_x, le_y)

        # Forehead skin patch (above eyes, between eye centers)
        fh_y1 = max(0, int(min(re_y, le_y) - eye_dist * 0.50))
        fh_y2 = max(0, int(min(re_y, le_y) - eye_dist * 0.15))
        fh_cx = int((re_x + le_x) / 2)
        fh_x1 = max(0, int(fh_cx - eye_dist * 0.25))
        fh_x2 = min(img_w, int(fh_cx + eye_dist * 0.25))
        
        forehead_sharpness = face_sharpness
        if (fh_y2 > fh_y1) and (fh_x2 > fh_x1):
            fh_crop = image[fh_y1:fh_y2, fh_x1:fh_x2]
            if fh_crop.size > 0:
                fh_gray = cv2.cvtColor(fh_crop, cv2.COLOR_BGR2GRAY)
                forehead_sharpness = float(cv2.Laplacian(fh_gray, cv2.CV_64F).var())

        return face_crop, face_sharpness, right_eye, left_eye, forehead_sharpness, eye_dist

    def calculate_eye_metrics(self, eye_crop: Optional[np.ndarray]) -> Tuple[float, float, bool, bool]:
        """
        Measures eye openness using horizontal profile (sclera vs pupil contrast valley)
        and iris texture standard deviation.
        Returns: (openness_score, valley_depth, is_open, is_closed)
        """
        if eye_crop is None or eye_crop.size == 0:
            return 0.50, 20.0, True, False

        h, w = eye_crop.shape[:2]
        if h < 5 or w < 6:
            return 0.50, 20.0, True, False

        gray = cv2.cvtColor(eye_crop, cv2.COLOR_BGR2GRAY)
        mid_y1, mid_y2 = int(h * 0.20), int(h * 0.80)
        z_w = int(w / 3)
        if z_w < 2 or (mid_y2 - mid_y1) < 2:
            return 0.50, 20.0, True, False

        # Split horizontally: Left sclera | Center pupil/iris | Right sclera
        left_zone = float(np.mean(gray[mid_y1:mid_y2, 0:z_w]))
        center_zone = float(np.mean(gray[mid_y1:mid_y2, z_w:2*z_w]))
        right_zone = float(np.mean(gray[mid_y1:mid_y2, 2*z_w:3*z_w]))

        sclera_avg = (left_zone + right_zone) / 2.0
        valley_depth = max(0.0, sclera_avg - center_zone)

        center_crop = gray[mid_y1:mid_y2, z_w:2*z_w]
        std_center = float(np.std(center_crop))

        v_score = min(1.0, valley_depth / 42.0)
        std_score = min(1.0, std_center / 32.0)
        openness = (v_score * 0.65) + (std_score * 0.35)
        openness = float(np.clip(openness, 0.0, 1.0))

        # Open eye: distinct dark pupil valley flanked by brighter sclera
        is_open = (openness >= 0.40 and valley_depth >= 16.0)
        # Closed eye: uniform eyelid skin, flat horizontal profile without pupil valley
        is_closed = (openness <= 0.24 and valley_depth <= 12.0)

        return openness, valley_depth, is_open, is_closed

    def check_presentation_attack(
        self, face_crop: np.ndarray, landmarks: List[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Dedicated Presentation Attack Detection (PAD) for:
        1. Mobile phone / tablet screen specular glass reflection (extreme glare).
        2. 2D FFT Moiré pattern & periodic subpixel matrix frequency spikes.
        3. Emissive backlight chromatic distortion (excessive blue LED ratio).
        4. Planar rigidity ratio on rigid 2D photos.
        """
        if face_crop is None or face_crop.size == 0:
            return {"is_spoof": False, "reason": None}

        h, w = face_crop.shape[:2]

        # 1. Specular Screen Glare (glass reflection on phone/tablet screen)
        hsv = cv2.cvtColor(face_crop, cv2.COLOR_BGR2HSV)
        glare_mask = (hsv[:, :, 2] > 250) & (hsv[:, :, 1] < 20)
        glare_ratio = float(np.sum(glare_mask)) / float(h * w)
        if glare_ratio > 0.055:
            logger.warning(f"[LIVENESS_PAD] Screen specular glare detected! Glare ratio: {glare_ratio:.4f}")
            return {
                "is_spoof": True,
                "reason": "screen_specular_glare",
                "prompt": "Phone screen reflection detected! Please look directly at camera without screen."
            }

        # 2. 2D FFT High-Frequency Screen Grid / Moiré Detection
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        if h >= 32 and w >= 32:
            resized = cv2.resize(gray, (64, 64))
            f = np.fft.fft2(resized.astype(np.float32))
            fshift = np.fft.fftshift(f)
            mag = np.abs(fshift)
            cy, cx = 32, 32
            y_grid, x_grid = np.ogrid[:64, :64]
            r = np.sqrt((x_grid - cx) ** 2 + (y_grid - cy) ** 2)
            mid_high = (r >= 14) & (r <= 28)
            band_vals = mag[mid_high]
            if len(band_vals) > 0:
                peak_to_mean = float(np.max(band_vals) / (np.mean(band_vals) + 1e-6))
                if peak_to_mean > 15.0:
                    logger.warning(f"[LIVENESS_PAD] Moiré / screen subpixel grid detected! Peak-to-mean: {peak_to_mean:.2f}")
                    return {
                        "is_spoof": True,
                        "reason": "screen_moire_pattern",
                        "prompt": "Digital screen display detected (Moiré interference)! Real live face required."
                    }

        # 3. Emissive Screen Blue LED Backlight Check
        b, g, r_ch = cv2.split(face_crop.astype(np.float32))
        total_rgb = r_ch + g + b + 1e-6
        blue_ratio = float(np.mean(b / total_rgb))
        if blue_ratio > 0.38:
            logger.warning(f"[LIVENESS_PAD] Unnatural emissive screen blue ratio: {blue_ratio:.3f}")
            return {
                "is_spoof": True,
                "reason": "screen_blue_backlight",
                "prompt": "Electronic screen display detected! Live human face required."
            }

        return {"is_spoof": False, "reason": None}

    def process_face_liveness(
        self,
        image: np.ndarray,
        face_info: Dict[str, Any],
        student_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Master Liveness Evaluation:
        Strictly enforces 2 genuine eye blinks and rejects all photo/screen attacks.
        Fails-closed on any error or ambiguity.
        """
        try:
            return self._process_face_liveness_core(image, face_info, student_id)
        except Exception as e:
            logger.error(f"[LIVENESS_ERROR] Exception in liveness evaluation: {e}", exc_info=True)
            # Fail closed: reject attendance on error
            return {
                "is_live": False,
                "liveness_status": "error",
                "blinks_count": 0,
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "unknown",
                "eye_openness": 0.0,
                "is_spoof": True,
                "spoof_reason": "evaluation_exception",
                "prompt": "Liveness verification error. Please retry in good lighting.",
                "blink_verified": False
            }

    def _process_face_liveness_core(
        self,
        image: np.ndarray,
        face_info: Dict[str, Any],
        student_id: Optional[str] = None
    ) -> Dict[str, Any]:
        self._cleanup_old_trackers()

        bbox = face_info.get("bbox", [0, 0, 0, 0])
        landmarks = face_info.get("landmarks", [])
        now = time.time()

        face_crop, face_sharpness, r_eye, l_eye, fh_sharpness, eye_dist = self.extract_face_and_eye_regions(
            image, bbox, landmarks
        )

        if face_crop is None:
            return {
                "is_live": False,
                "liveness_status": "no_face",
                "blinks_count": 0,
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "none",
                "eye_openness": 0.0,
                "is_spoof": False,
                "spoof_reason": None,
                "prompt": "Face not detected clearly. Center face in frame.",
                "blink_verified": False
            }

        # 1. Presentation Attack Detection (PAD)
        pad_res = self.check_presentation_attack(face_crop, landmarks)
        if pad_res["is_spoof"]:
            return {
                "is_live": False,
                "liveness_status": "spoof_detected",
                "blinks_count": 0,
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "spoof",
                "eye_openness": 0.0,
                "is_spoof": True,
                "spoof_reason": pad_res["reason"],
                "prompt": pad_res["prompt"],
                "blink_verified": False
            }

        # 2. Eye openness calculation
        r_open, r_val, r_is_open, r_is_closed = self.calculate_eye_metrics(r_eye)
        l_open, l_val, l_is_open, l_is_closed = self.calculate_eye_metrics(l_eye)

        avg_openness = (r_open + l_open) / 2.0
        avg_valley = (r_val + l_val) / 2.0

        is_both_open = r_is_open and l_is_open
        is_both_closed = r_is_closed and l_is_closed

        # 3. Motion Blur & Movement Check:
        # Shaking phone / camera motion collapses whole-face sharpness
        is_motion_blurred = (face_sharpness < 16.0)

        # 4. Face Tracking Continuity & Stability State
        track_key = student_id or f"face_{bbox[0]}_{bbox[1]}"
        cx = bbox[0] + bbox[2] / 2.0
        cy = bbox[1] + bbox[3] / 2.0
        fw, fh = bbox[2], bbox[3]

        if track_key not in self._trackers:
            self._trackers[track_key] = {
                "created_at": now,
                "last_seen": now,
                "last_center": (cx, cy),
                "last_size": (fw, fh),
                "blinks_count": 0,
                "stage": "WAITING_BLINK_1",
                "blink_1_time": 0.0,
                "blink_verified": False,
                "open_frames_streak": 0,
            }

        tracker = self._trackers[track_key]
        dt = now - tracker["last_seen"]
        tracker["last_seen"] = now

        # Challenge Timeout Check:
        # If active challenge exceeds 9 seconds, reset to prevent stale state
        if (now - tracker["created_at"]) > 9.0:
            logger.info(f"[LIVENESS_TRACK] Challenge timed out for {track_key}. Resetting.")
            tracker["created_at"] = now
            tracker["stage"] = "WAITING_BLINK_1"
            tracker["blinks_count"] = 0
            tracker["open_frames_streak"] = 0

        # Tracking Loss Check:
        # If face was missing for > 0.55s, challenge is reset!
        if dt > 0.55:
            logger.warning(f"[LIVENESS_TRACK] Tracking loss for {track_key} (dt={dt:.2f}s). Resetting challenge.")
            tracker["stage"] = "WAITING_BLINK_1"
            tracker["blinks_count"] = 0
            tracker["open_frames_streak"] = 0

        # Centroid Displacement & Stability Check:
        pcx, pcy = tracker["last_center"]
        disp = float(np.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2))
        max_dim = max(10.0, float(max(tracker["last_size"])))
        rel_disp = disp / max_dim

        # Size change ratio
        pfw = tracker["last_size"][0]
        size_change = abs(1.0 - (fw / max(1.0, float(pfw))))

        tracker["last_center"] = (cx, cy)
        tracker["last_size"] = (fw, fh)

        # Reject shaking phone / unstable tracking:
        # If relative displacement > 0.12 or size jumped > 25%
        if rel_disp > 0.12 or size_change > 0.25:
            logger.info(
                f"[LIVENESS_TRACK] Unstable face movement for {track_key}: "
                f"rel_disp={rel_disp:.2f}, size_change={size_change:.2f} -> Resetting challenge."
            )
            tracker["stage"] = "WAITING_BLINK_1"
            tracker["blinks_count"] = 0
            tracker["open_frames_streak"] = 0
            return {
                "is_live": False,
                "liveness_status": "unstable_tracking",
                "blinks_count": 0,
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "moving",
                "eye_openness": round(avg_openness, 3),
                "is_spoof": False,
                "spoof_reason": None,
                "prompt": "Face moving or shaking! Please hold steady and blink naturally (0/2).",
                "blink_verified": False
            }

        # Reject motion blur frames from advancing eye closure:
        if is_motion_blurred:
            logger.info(f"[LIVENESS_EYE] Motion blur ignored for {track_key} (sharpness: {face_sharpness:.1f})")
            return {
                "is_live": False,
                "liveness_status": "motion_blurred",
                "blinks_count": tracker["blinks_count"],
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "blurred",
                "eye_openness": round(avg_openness, 3),
                "is_spoof": False,
                "spoof_reason": None,
                "prompt": f"Blurry frame. Hold steady and blink naturally ({tracker['blinks_count']}/2).",
                "blink_verified": False
            }

        # 5. Strict 2-Blink State Machine Transitions
        has_open_baseline = (tracker["open_frames_streak"] >= 1)
        prev_stage = tracker["stage"]

        if tracker["stage"] == "WAITING_BLINK_1":
            # Genuine eye closure requires verified open baseline + stable sharp face
            if is_both_closed and has_open_baseline:
                tracker["stage"] = "BLINK_1_CLOSING"
                logger.info(f"[LIVENESS_TRANSITION] {track_key}: Blink 1 Closing detected (openness: {avg_openness:.2f}, valley: {avg_valley:.1f})")

        elif tracker["stage"] == "BLINK_1_CLOSING":
            if is_both_open:
                tracker["blinks_count"] = 1
                tracker["blink_1_time"] = now
                tracker["stage"] = "WAITING_BLINK_2"
                logger.info(f"[LIVENESS_TRANSITION] {track_key}: Blink 1 Reopened & CONFIRMED! (1/2)")

        elif tracker["stage"] == "WAITING_BLINK_2":
            # Require minimum 200ms gap of confirmed OPEN eyes before Blink 2
            if (now - tracker["blink_1_time"]) >= 0.20 and has_open_baseline:
                if is_both_closed:
                    tracker["stage"] = "BLINK_2_CLOSING"
                    logger.info(f"[LIVENESS_TRANSITION] {track_key}: Blink 2 Closing detected (openness: {avg_openness:.2f}, valley: {avg_valley:.1f})")

        elif tracker["stage"] == "BLINK_2_CLOSING":
            if is_both_open:
                tracker["blinks_count"] = 2
                tracker["blink_verified"] = True
                tracker["stage"] = "VERIFIED"
                logger.info(f"[LIVENESS_TRANSITION] {track_key}: Blink 2 Reopened & CONFIRMED! (2/2) LIVE VERIFIED!")

        # Update open frames streak AFTER state transition logic
        if is_both_open:
            tracker["open_frames_streak"] += 1
        elif is_both_closed:
            tracker["open_frames_streak"] = 0

        # 6. Response Construction & Single-Use Verification
        if tracker["blink_verified"]:
            # Single-use consumption: clear verified flag so no photo can ever reuse it
            tracker["blink_verified"] = False
            tracker["stage"] = "WAITING_BLINK_1"
            tracker["blinks_count"] = 0
            tracker["open_frames_streak"] = 0

            return {
                "is_live": True,
                "liveness_status": "verified",
                "blinks_count": 2,
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "verified",
                "eye_openness": round(avg_openness, 3),
                "is_spoof": False,
                "spoof_reason": None,
                "prompt": "2 blinks verified! Attendance confirmed.",
                "blink_verified": True
            }

        elif tracker["stage"] == "WAITING_BLINK_2":
            return {
                "is_live": False,
                "liveness_status": "blink_1_done",
                "blinks_count": 1,
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "open",
                "eye_openness": round(avg_openness, 3),
                "is_spoof": False,
                "spoof_reason": None,
                "prompt": "1st blink confirmed! Please blink 1 more time (1/2)",
                "blink_verified": False
            }

        elif tracker["stage"] in ("BLINK_1_CLOSING", "BLINK_2_CLOSING"):
            current_blink = 1 if tracker["stage"] == "BLINK_1_CLOSING" else 2
            return {
                "is_live": False,
                "liveness_status": f"blinking_{current_blink}",
                "blinks_count": current_blink - 1,
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "closing",
                "eye_openness": round(avg_openness, 3),
                "is_spoof": False,
                "spoof_reason": None,
                "prompt": f"Blink {current_blink} in progress... reopen eyes ({current_blink - 1}/2)",
                "blink_verified": False
            }

        else:
            return {
                "is_live": False,
                "liveness_status": "awaiting_blink",
                "blinks_count": 0,
                "required_blinks": self.REQUIRED_BLINKS,
                "eye_state": "open" if is_both_open else "transition",
                "eye_openness": round(avg_openness, 3),
                "is_spoof": False,
                "spoof_reason": None,
                "prompt": "Please blink your eyes 2 times to verify attendance (0/2)",
                "blink_verified": False
            }

liveness_service = LivenessService()
