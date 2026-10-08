import base64
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np
from app.config import settings

logger = logging.getLogger("faceattend.face_recognition")

class FaceRecognitionService:
    def __init__(self):
        self.detector = None
        self.recognizer = None
        self.model_status = "uninitialized"
        self._init_models()

    def _init_models(self):
        models_dir = settings.MODELS_DIR
        yunet_path = models_dir / "face_detection_yunet_2023mar.onnx"
        sface_path = models_dir / "face_recognition_sface_2021dec.onnx"

        if yunet_path.exists() and sface_path.exists():
            try:
                # YuNet detector with score threshold and NMS threshold
                self.detector = cv2.FaceDetectorYN.create(
                    str(yunet_path),
                    "",
                    (320, 320),
                    score_threshold=settings.MIN_FACE_CONFIDENCE,
                    nms_threshold=0.3,
                    top_k=5000
                )
                # SFace recognizer
                self.recognizer = cv2.FaceRecognizerSF.create(str(sface_path), "")
                self.model_status = "opencv_sface"
                logger.info("OpenCV YuNet & SFace models loaded successfully!")
            except Exception as e:
                logger.error(f"Failed to load OpenCV ONNX models: {e}. Fallback mode active.")
                self.model_status = "demo_fallback"
        else:
            logger.warning("Model files not found. Fallback mode active.")
            self.model_status = "demo_fallback"

    def decode_image(self, image_data: str) -> np.ndarray:
        """Decodes base64 string or data URL into OpenCV BGR numpy array."""
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Invalid image data or corrupted format.")
        return img

    def check_face_quality(self, face_crop: np.ndarray) -> Tuple[bool, float, str]:
        """Evaluates face image quality (blurriness, brightness, size)."""
        h, w = face_crop.shape[:2]
        if w < 50 or h < 50:
            return False, 0.0, "Face is too small. Please move closer to the camera."

        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        
        # Sharpness / Blur estimation via Laplacian variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        quality_score = min(1.0, laplacian_var / 300.0)

        # Brightness check
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 40:
            return False, quality_score, "Image is too dark. Increase lighting."
        if mean_brightness > 220:
            return False, quality_score, "Image is overexposed. Reduce direct glare."

        if quality_score < 0.20:
            return False, quality_score, "Face image is blurry. Please hold steady."

        return True, quality_score, "Good quality"

    def detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detects all faces in the given image. Returns list of detected face metadata."""
        h, w = image.shape[:2]
        if self.detector is None or self.model_status == "demo_fallback":
            # Fallback to Haar Cascade
            return self._detect_faces_fallback(image)

        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image)
        
        results = []
        if faces is not None:
            for face in faces:
                x, y, fw, fh = map(int, face[:4])
                score = float(face[-1])
                # Ensure box stays within bounds
                x = max(0, x)
                y = max(0, y)
                fw = min(fw, w - x)
                fh = min(fh, h - y)

                landmarks = face[4:14].reshape((5, 2)).tolist()
                results.append({
                    "bbox": [x, y, fw, fh],
                    "confidence": round(score, 3),
                    "landmarks": landmarks,
                    "raw_face": face
                })
        return results

    def _detect_faces_fallback(self, image: np.ndarray) -> List[Dict[str, Any]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        results = []
        for (x, y, w, h) in faces:
            results.append({
                "bbox": [int(x), int(y), int(w), int(h)],
                "confidence": 0.85,
                "landmarks": [],
                "raw_face": None
            })
        return results

    def generate_embedding(self, image: np.ndarray, face_info: Dict[str, Any]) -> List[float]:
        """Aligns and computes the 128-dimensional L2-normalized face embedding."""
        if self.recognizer is not None and face_info.get("raw_face") is not None:
            raw_face = face_info["raw_face"]
            aligned_face = self.recognizer.alignCrop(image, raw_face)
            feature = self.recognizer.feature(aligned_face)
            # L2 normalize
            feature = feature.flatten()
            norm = np.linalg.norm(feature)
            if norm > 1e-6:
                feature = feature / norm
            return feature.tolist()
        else:
            # Fallback embedding generation using normalized color + texture histogram
            x, y, w, h = face_info["bbox"]
            crop = image[y:y+h, x:x+w]
            if crop.size == 0:
                crop = cv2.resize(image, (112, 112))
            else:
                crop = cv2.resize(crop, (112, 112))
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [128], [0, 256]).flatten()
            norm = np.linalg.norm(hist)
            if norm > 0:
                hist = hist / norm
            return hist.tolist()

    @staticmethod
    def compare_embeddings(embedding1: List[float], embedding2: List[float]) -> float:
        """Calculates cosine similarity between two face embeddings. Range: [-1.0, 1.0]."""
        v1 = np.array(embedding1, dtype=np.float32)
        v2 = np.array(embedding2, dtype=np.float32)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 < 1e-6 or norm2 < 1e-6:
            return 0.0
        similarity = float(np.dot(v1, v2) / (norm1 * norm2))
        return max(-1.0, min(1.0, similarity))

    def recognize_frame(
        self,
        image: np.ndarray,
        registered_records: List[Dict[str, Any]],
        threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Processes each detected face in the frame independently and matches against registered faces."""
        threshold = threshold if threshold is not None else settings.RECOGNITION_THRESHOLD
        detected_faces = self.detect_faces(image)
        recognition_results = []

        for face in detected_faces:
            x, y, w, h = face["bbox"]
            crop = image[y:y+h, x:x+w]
            is_valid, quality, quality_msg = self.check_face_quality(crop)

            face_embedding = self.generate_embedding(image, face)

            best_match = None
            best_similarity = -1.0

            for record in registered_records:
                reg_emb = record.get("embedding")
                if not reg_emb:
                    continue
                sim = self.compare_embeddings(face_embedding, reg_emb)
                if sim > best_similarity:
                    best_similarity = sim
                    best_match = record

            # Check if match meets confidence threshold
            if best_match and best_similarity >= threshold:
                confidence_pct = round(best_similarity * 100, 1)
                recognition_results.append({
                    "recognized": True,
                    "student": {
                        "id": best_match.get("studentId"),
                        "studentId": best_match.get("studentId"),
                        "name": best_match.get("studentName", "Unknown"),
                        "rollNumber": best_match.get("rollNumber", ""),
                        "branch": best_match.get("branch", ""),
                        "year": best_match.get("year", "")
                    },
                    "confidence": round(best_similarity, 3),
                    "confidencePercent": confidence_pct,
                    "bbox": face["bbox"],
                    "landmarks": face["landmarks"],
                    "quality": round(quality, 2),
                    "status": "recognized"
                })
            else:
                # Distinguish between low confidence and completely unknown
                is_low_confidence = best_match is not None and best_similarity >= (threshold * 0.7)
                msg = (
                    "Face detected but recognition confidence is insufficient."
                    if is_low_confidence
                    else "Unknown Face - This person is not registered."
                )
                recognition_results.append({
                    "recognized": False,
                    "message": msg,
                    "confidence": round(best_similarity, 3) if best_similarity > 0 else 0.0,
                    "confidencePercent": round(best_similarity * 100, 1) if best_similarity > 0 else 0.0,
                    "bbox": face["bbox"],
                    "landmarks": face["landmarks"],
                    "quality": round(quality, 2),
                    "status": "low_confidence" if is_low_confidence else "unknown"
                })

        return recognition_results

face_service = FaceRecognitionService()
