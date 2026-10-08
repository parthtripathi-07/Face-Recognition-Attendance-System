import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Camera, CheckCircle2, AlertCircle, ArrowLeft, ScanFace,
  RefreshCw, Sparkles, Info, ShieldCheck,
} from 'lucide-react';
import CameraView from '../components/CameraView';
import { studentsAPI, facesAPI } from '../services/api';

const REQUIRED_SAMPLES = 5;

export default function FaceRegistrationPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [samples, setSamples] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const captureFrameFn = useRef(null);

  useEffect(() => {
    async function loadStudent() {
      try {
        setLoadingStudent(true);
        const res = await studentsAPI.getById(studentId);
        setStudent(res.data);
      } catch (err) {
        console.error('Error fetching student:', err);
        setError(`Student with ID "${studentId}" was not found.`);
      } finally {
        setLoadingStudent(false);
      }
    }
    loadStudent();
  }, [studentId]);

  const handleCaptureSample = () => {
    setError('');
    setMessage('');
    if (!captureFrameFn.current) {
      setError('Camera is not ready yet. Please ensure camera access is granted.');
      return;
    }

    const frame = captureFrameFn.current();
    if (!frame) {
      setError('Failed to capture frame from video feed. Please try again.');
      return;
    }

    const newSamples = [...samples, frame];
    setSamples(newSamples);
    setCurrentStep(newSamples.length);

    if (newSamples.length < REQUIRED_SAMPLES) {
      const guidance = [
        'Sample 1 captured! Now turn your head slightly to the left.',
        'Sample 2 captured! Now turn your head slightly to the right.',
        'Sample 3 captured! Tilt your chin slightly up or down.',
        'Sample 4 captured! Keep looking straight for the final sample.',
      ];
      setMessage(guidance[newSamples.length - 1] || 'Sample captured! Please reposition slightly.');
    } else {
      setMessage('All 5 samples captured successfully! Submitting biometric profile to server...');
      submitSamples(newSamples);
    }
  };

  const submitSamples = async (capturedSamples) => {
    try {
      setSaving(true);
      setError('');
      const res = await facesAPI.register(studentId, { samples: capturedSamples });
      setSuccess(true);
      setMessage(res.data.message || 'Face registered successfully!');
    } catch (err) {
      console.error('Registration error:', err);
      const detail = err.response?.data?.detail || 'Face registration failed. Please try again.';
      setError(detail);
      setSamples([]);
      setCurrentStep(0);
    } finally {
      setSaving(false);
    }
  };

  const resetCapture = () => {
    setSamples([]);
    setCurrentStep(0);
    setError('');
    setMessage('');
    setSuccess(false);
  };

  if (loadingStudent) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-sky-500 mr-2" />
        <span>Loading student details...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/students"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Face Biometric Enrollment</h1>
            <p className="text-xs text-slate-400">
              Register high-precision ArcFace embeddings for automatic attendance identification.
            </p>
          </div>
        </div>

        {student && (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-right">
            <span className="block text-xs font-bold text-sky-600 dark:text-sky-400">{student.name}</span>
            <span className="text-[11px] font-mono text-slate-500">
              {student.rollNumber} &bull; {student.branch} ({student.studentId})
            </span>
          </div>
        )}
      </div>

      {success && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center text-emerald-800 dark:text-emerald-300 animate-fadeIn">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold">Face Registration Complete!</h3>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
            {message} Biometric vector generated and stored in numerical format.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              to="/students"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Back to Students List
            </Link>
            <Link
              to="/attendance/live"
              className="rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-sky-500/25 hover:brightness-105"
            >
              Test Live Recognition
            </Link>
          </div>
        </div>
      )}

      {!success && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <CameraView
              onFrameCapture={(fn) => {
                captureFrameFn.current = fn;
              }}
              isProcessing={saving}
              showGuides={true}
            />

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-medium text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {message && !error && (
              <div className="flex items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs font-medium text-sky-600 dark:text-sky-400 animate-fadeIn">
                <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
                <span>{message}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Progress:</span>
                <div className="flex items-center gap-2">
                  {[...Array(REQUIRED_SAMPLES)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-4 w-4 rounded-full transition-all duration-300 flex items-center justify-center text-[9px] font-bold ${
                        i < currentStep
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/40 scale-110'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {i < currentStep ? '?' : i + 1}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-semibold text-sky-500 ml-1">
                  ({currentStep}/{REQUIRED_SAMPLES})
                </span>
              </div>

              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={resetCapture}
                    disabled={saving}
                    className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={handleCaptureSample}
                  disabled={saving || currentStep >= REQUIRED_SAMPLES}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:brightness-105 active:scale-95 disabled:opacity-50 transition"
                >
                  <Camera className="h-4 w-4" />
                  <span>
                    {saving
                      ? 'Generating Vector...'
                      : currentStep === 0
                      ? 'Capture Sample 1'
                      : `Capture Sample ${currentStep + 1}`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-3">
                <Info className="h-4 w-4 text-sky-500" />
                <h3 className="text-sm">Capture Guidelines</h3>
              </div>

              <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/10 font-bold text-sky-500 text-[10px]">
                    1
                  </span>
                  <span>Look directly into the camera lens with your head positioned inside the guide frame.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/10 font-bold text-sky-500 text-[10px]">
                    2
                  </span>
                  <span>Ensure your face is well illuminated and avoid strong backlights or shadows.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/10 font-bold text-sky-500 text-[10px]">
                    3
                  </span>
                  <span>Remove sunglasses, masks, or hats that cover forehead or eyes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/10 font-bold text-sky-500 text-[10px]">
                    4
                  </span>
                  <span>
                    Capture 5 samples while slightly varying your angle (straight, slight left, slight right, slight tilt).
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-5 dark:border-slate-800/80 dark:bg-slate-900/40">
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-700 dark:text-slate-300 mb-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Biometric Privacy Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Raw camera images are not permanently stored on the server. The backend processes the image in memory to compute a 128-dimensional numerical feature vector (embedding) for attendance recognition only.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
