import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes idle = auto logout
const WARN_BEFORE_MS  = 5 * 60 * 1000;    // warn 5 minutes before logout
const WARN_AT_MS      = IDLE_TIMEOUT_MS - WARN_BEFORE_MS; // 25 min

export default function SessionTimeout() {
  const { isAuthenticated } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(WARN_BEFORE_MS / 1000));

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch (_) {}
    window.location.href = "/login";
  }, []);

  const clearAllTimers = () => {
    if (idleTimerRef.current)  clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current)  clearTimeout(warnTimerRef.current);
    if (countdownRef.current)  clearInterval(countdownRef.current);
  };

  const startTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(Math.round(WARN_BEFORE_MS / 1000));
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(countdownRef.current!); return 0; }
          return s - 1;
        });
      }, 1000);
    }, WARN_AT_MS);

    idleTimerRef.current = setTimeout(() => {
      logout();
    }, IDLE_TIMEOUT_MS);
  }, [logout]);

  const handleActivity = useCallback(() => {
    if (!isAuthenticated) return;
    startTimers();
  }, [isAuthenticated, startTimers]);

  const stayActive = () => {
    setShowWarning(false);
    startTimers();
  };

  useEffect(() => {
    if (!isAuthenticated) { clearAllTimers(); return; }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    startTimers();

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      clearAllTimers();
    };
  }, [isAuthenticated, handleActivity, startTimers]);

  if (!isAuthenticated) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session About to Expire</AlertDialogTitle>
          <AlertDialogDescription>
            You have been inactive for a while. For your security, you will be automatically signed out in{" "}
            <span className="font-bold text-destructive">{timeStr}</span>.
            <br /><br />
            Click "Stay Signed In" to continue your session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={logout} className="text-destructive border-destructive hover:bg-destructive/10">
            Sign Out Now
          </AlertDialogCancel>
          <AlertDialogAction onClick={stayActive}>
            Stay Signed In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
