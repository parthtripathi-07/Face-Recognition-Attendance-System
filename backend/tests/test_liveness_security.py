import time
import cv2
import numpy as np
import pytest
from app.services.liveness_service import LivenessService, liveness_service

def generate_face_frame(dx=0, dy=0, blur=0, eye_open=True, add_glare=False, add_moire=False, add_blue=False):
    """Generates realistic synthetic test frames for testing liveness and PAD."""
    img = np.full((480, 640, 3), 110, dtype=np.uint8)
    fx, fy = 200 + dx, 140 + dy
    fw, fh = 180, 220

    # Natural skin tone with subtle sensor noise
    face = np.full((fh, fw, 3), (170, 190, 215), dtype=np.uint8)
    noise = np.random.normal(0, 3.5, face.shape).astype(np.int16)
    face = np.clip(face.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    cv2.putText(face, "SKIN", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (140, 160, 185), 1)

    re_x, re_y = 50, 90
    le_x, le_y = 130, 90

    for ex, ey in [(re_x, re_y), (le_x, le_y)]:
        if eye_open:
            cv2.ellipse(face, (ex, ey), (18, 10), 0, 0, 360, (240, 240, 245), -1)
            cv2.circle(face, (ex, ey), 6, (35, 35, 40), -1)
        else:
            cv2.ellipse(face, (ex, ey), (18, 10), 0, 0, 360, (165, 185, 210), -1)
            cv2.line(face, (ex-16, ey), (ex+16, ey), (120, 135, 160), 2)

    cv2.circle(face, (90, 130), 5, (130, 145, 170), -1)
    cv2.line(face, (65, 175), (115, 175), (120, 110, 170), 3)

    if add_glare:
        # Specular reflection from glass
        cv2.rectangle(face, (20, 20), (80, 60), (255, 255, 255), -1)

    if add_moire:
        # Periodic high-frequency screen grid pattern (without saturated specular glare)
        y_idx, x_idx = np.ogrid[:fh, :fw]
        grid_pattern = ((x_idx % 4 == 0) | (y_idx % 4 == 0)).astype(np.uint8) * 45
        for c in range(3):
            face[:, :, c] = np.clip(face[:, :, c].astype(np.int16) + grid_pattern - 30, 10, 230).astype(np.uint8)

    if add_blue:
        # Unnatural blue backlight leakage (BGR)
        face[:, :, 0] = 230  # Blue
        face[:, :, 1] = 120  # Green
        face[:, :, 2] = 120  # Red

    img[fy:fy+fh, fx:fx+fw] = face

    if blur > 0:
        k = blur * 2 + 1
        img = cv2.GaussianBlur(img, (k, k), 0)

    landmarks = [
        [fx + re_x, fy + re_y],
        [fx + le_x, fy + le_y],
        [fx + 90, fy + 130],
        [fx + 65, fy + 175],
        [fx + 115, fy + 175]
    ]
    bbox = [fx, fy, fw, fh]
    return img, {"bbox": bbox, "landmarks": landmarks}


def test_shaken_mobile_phone_attack_rejected():
    """
    CRITICAL USER BUG REPRODUCTION TEST:
    A static photo on a mobile phone with open eyes is shown to the camera.
    The user shakes the mobile phone twice instead of blinking.
    Expected: Liveness MUST REJECT, blinks_count must be 0, and verified must be False.
    """
    svc = LivenessService()
    student_id = "ST_TEST_SHAKE"

    shaken_sequence = [
        # Stationary open baseline
        (0, 0, 0, True),
        (0, 0, 0, True),
        # Shake 1: rapid displacement & motion blur
        (25, -20, 8, True),
        (35, -25, 10, True),
        (0, 0, 0, True),
        (0, 0, 0, True),
        # Shake 2: rapid displacement & motion blur
        (-25, 20, 8, True),
        (-35, 25, 10, True),
        (0, 0, 0, True),
        (0, 0, 0, True),
    ]

    for dx, dy, blur, eopen in shaken_sequence:
        img, finfo = generate_face_frame(dx, dy, blur, eopen)
        res = svc.process_face_liveness(img, finfo, student_id=student_id)

    # Final state check:
    assert res["is_live"] is False, "CRITICAL: Shaken mobile phone must NOT pass liveness!"
    assert res["blink_verified"] is False, "CRITICAL: Shaken mobile phone must NOT be verified!"
    assert res.get("blinks_count", 0) == 0, f"Expected 0 blinks, got {res.get('blinks_count')}"


def test_static_mobile_photo_rejected():
    """
    Static photo held steady in front of camera.
    Expected: Remains at 0/2 blinks, never verified.
    """
    svc = LivenessService()
    student_id = "ST_TEST_STATIC"

    for _ in range(12):
        img, finfo = generate_face_frame(0, 0, 0, True)
        res = svc.process_face_liveness(img, finfo, student_id=student_id)

    assert res["is_live"] is False
    assert res["blink_verified"] is False
    assert res["blinks_count"] == 0
    assert res["liveness_status"] == "awaiting_blink"


def test_presentation_attack_specular_glare():
    """
    Mobile phone screen with glass glare reflection.
    Expected: PAD flags screen_specular_glare, spoof_detected.
    """
    svc = LivenessService()
    img, finfo = generate_face_frame(0, 0, 0, True, add_glare=True)
    res = svc.process_face_liveness(img, finfo, student_id="ST_GLARE")

    assert res["is_spoof"] is True
    assert res["spoof_reason"] == "screen_specular_glare"
    assert res["is_live"] is False


def test_presentation_attack_screen_moire():
    """
    Digital display with high-frequency periodic subpixel grid.
    Expected: PAD flags screen_moire_pattern.
    """
    svc = LivenessService()
    img, finfo = generate_face_frame(0, 0, 0, True, add_moire=True)
    res = svc.process_face_liveness(img, finfo, student_id="ST_MOIRE")

    assert res["is_spoof"] is True
    assert res["spoof_reason"] == "screen_moire_pattern"
    assert res["is_live"] is False


def test_presentation_attack_blue_backlight():
    """
    Screen display with excessive blue LED emission.
    Expected: PAD flags screen_blue_backlight.
    """
    svc = LivenessService()
    img, finfo = generate_face_frame(0, 0, 0, True, add_blue=True)
    res = svc.process_face_liveness(img, finfo, student_id="ST_BLUE")

    assert res["is_spoof"] is True
    assert res["spoof_reason"] == "screen_blue_backlight"
    assert res["is_live"] is False


def test_tracking_instability_resets_challenge():
    """
    Sudden jump in face position (relative displacement > 0.12).
    Expected: Challenge resets to 0.
    """
    svc = LivenessService()
    student_id = "ST_TRACK_INSTABILITY"

    # Frame 1: steady
    img, finfo = generate_face_frame(0, 0, 0, True)
    svc.process_face_liveness(img, finfo, student_id=student_id)

    # Sudden jump by 60 pixels
    img_jump, finfo_jump = generate_face_frame(60, 40, 0, True)
    res = svc.process_face_liveness(img_jump, finfo_jump, student_id=student_id)

    assert res["liveness_status"] == "unstable_tracking"
    assert res["blinks_count"] == 0
    assert res["is_live"] is False


def test_tracking_loss_resets_challenge():
    """
    Face tracking dropped for > 0.55 seconds.
    Expected: Challenge resets to 0.
    """
    svc = LivenessService()
    student_id = "ST_TRACK_LOSS"

    # Frame 1: steady open
    img, finfo = generate_face_frame(0, 0, 0, True)
    svc.process_face_liveness(img, finfo, student_id=student_id)

    # Frame 2: genuine blink 1 closing
    img_c, finfo_c = generate_face_frame(0, 0, 0, False)
    svc.process_face_liveness(img_c, finfo_c, student_id=student_id)

    # Frame 3: genuine blink 1 open
    res_b1 = svc.process_face_liveness(img, finfo, student_id=student_id)
    assert res_b1["blinks_count"] == 1

    # Simulate face drop of 3.0 seconds by manually adjusting last_seen (> 2.5s)
    svc._trackers[student_id]["last_seen"] -= 3.0

    # Face returns
    res_after = svc.process_face_liveness(img, finfo, student_id=student_id)
    assert res_after["blinks_count"] == 0, "Challenge must reset to 0 after tracking loss!"
    assert res_after["is_live"] is False


def test_incomplete_challenge_rejected():
    """
    Student blinks only 1 time and stops.
    Expected: Attendance not verified (requires strictly 2 blinks).
    """
    svc = LivenessService()
    student_id = "ST_INCOMPLETE"

    # 1 blink only
    img_o, finfo_o = generate_face_frame(0, 0, 0, True)
    img_c, finfo_c = generate_face_frame(0, 0, 0, False)

    svc.process_face_liveness(img_o, finfo_o, student_id=student_id)
    svc.process_face_liveness(img_c, finfo_c, student_id=student_id)
    res = svc.process_face_liveness(img_o, finfo_o, student_id=student_id)

    assert res["blinks_count"] == 1
    assert res["is_live"] is False
    assert res["blink_verified"] is False
    assert res["liveness_status"] == "blink_1_done"


def test_genuine_live_student_verified():
    """
    Genuine live student: steady face, 2 full natural blinks.
    Expected: Verified = True, blinks_count = 2, is_live = True.
    """
    svc = LivenessService()
    student_id = "ST_GENUINE"

    img_o, finfo_o = generate_face_frame(0, 0, 0, True)
    img_c, finfo_c = generate_face_frame(0, 0, 0, False)

    # Open baseline
    svc.process_face_liveness(img_o, finfo_o, student_id=student_id)
    # Blink 1: close
    svc.process_face_liveness(img_c, finfo_c, student_id=student_id)
    # Blink 1: reopen
    res_b1 = svc.process_face_liveness(img_o, finfo_o, student_id=student_id)
    assert res_b1["blinks_count"] == 1

    # Inter-blink open pause: ensure >= 200ms
    svc._trackers[student_id]["blink_1_time"] -= 0.25

    # Blink 2: close
    svc.process_face_liveness(img_c, finfo_c, student_id=student_id)
    # Blink 2: reopen
    res_b2 = svc.process_face_liveness(img_o, finfo_o, student_id=student_id)

    assert res_b2["is_live"] is True, "Genuine student must pass liveness!"
    assert res_b2["blink_verified"] is True
    assert res_b2["blinks_count"] == 2
    assert res_b2["liveness_status"] == "verified"


def test_single_use_verification_consumption():
    """
    Single-use verification token: once verified, the state is consumed immediately.
    A subsequent frame (or photo) CANNOT reuse the verification!
    """
    svc = LivenessService()
    student_id = "ST_ATOMIC_TOKEN"

    img_o, finfo_o = generate_face_frame(0, 0, 0, True)
    img_c, finfo_c = generate_face_frame(0, 0, 0, False)

    # Perform 2 blinks to verify
    svc.process_face_liveness(img_o, finfo_o, student_id=student_id)
    svc.process_face_liveness(img_c, finfo_c, student_id=student_id)
    svc.process_face_liveness(img_o, finfo_o, student_id=student_id)
    svc._trackers[student_id]["blink_1_time"] -= 0.25
    svc.process_face_liveness(img_c, finfo_c, student_id=student_id)
    res_verified = svc.process_face_liveness(img_o, finfo_o, student_id=student_id)

    assert res_verified["blink_verified"] is True

    # Immediate NEXT frame: Must NOT be verified!
    res_next = svc.process_face_liveness(img_o, finfo_o, student_id=student_id)
    assert res_next["blink_verified"] is False, "Verification token must be single-use and cannot be reused!"
    assert res_next["is_live"] is False
    assert res_next["blinks_count"] == 0
