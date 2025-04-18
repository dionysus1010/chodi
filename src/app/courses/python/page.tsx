"use client";
import { useEffect, useState, useRef } from "react";
import { Lesson } from "@/types/lesson";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import PythonEditor from "../../components/editors/PythonEditor/PythonEditor";


import lessons from "../../../lessons/python_lesson.json";

interface User {
  username: string;
  email: string;
  id: number;
  points?: number;
}

export default function PythonCourses() {
  const [pythonLessons, setPythonLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastOutput, setLastOutput] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const editorRef = useRef<any>(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      Swal.fire({
        icon: 'warning',
        title: 'Access Denied',
        text: 'Please login first to access Python Course',
        confirmButtonText: 'Go to Login'
      }).then((result) => {
        if (result.isConfirmed) {
          router.push('/login');
        }
      });
    } else {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setUserId(userData.id);
    }

    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [router]);

  useEffect(() => {
    const loadLessonsAndProgress = async () => {
      const pythonLessons = lessons.map((lesson: Lesson) => ({
        ...lesson,
        courseId: 'python'
      }));
      setPythonLessons(pythonLessons);
      if (pythonLessons.length > 0) setSelectedLesson(pythonLessons[0]);

      if (userId) {
        try {
          const response = await fetch(`/api/progress?userId=${userId}&courseId=python`);
          if (!response.ok) throw new Error("Failed to fetch progress");
          const data = await response.json();
          const progressMap = data.reduce(
            (acc: Record<string, boolean>, item: any) => {
              acc[item.lesson_id] = item.completed;
              return acc;
            },
            {}
          );
          setProgress(progressMap);
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Oops...",
            text: "Failed to load progress data",
          });
        }
      }
    };

    loadLessonsAndProgress();
  }, [userId]);

  useEffect(() => {
    setLastOutput(null);
  }, [selectedLesson]);


   // For checking certificates
  const checkCertificates = async () => {
    try {
      const response = await fetch(`/api/certificates?userId=${userId}&courseId=python`);
      if (!response.ok) throw new Error('Failed to check certificates');
      return await response.json();
    } catch (error) {
      console.error('Certificate check failed:', error);
      return [];
    }
  };
  
    useEffect(() => {
      const checkCertificate = async () => {
        if (userId && pythonLessons.length > 0) {
          try {
            const response = await fetch(`/api/certificates?userId=${userId}&courseId=python`);
            if (response.ok) {
              const certificates = await response.json();
              setHasCertificate(certificates.length > 0);
            }
          } catch (error) {
            console.error("Error checking certificates:", error);
          }
        }
      };
    
      checkCertificate();
    }, [userId, progress, pythonLessons.length]);
  
  
    // For generating certificates
  const handleGenerateCertificate = async () => {
    try {
      const response = await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId: 'python' })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate certificate');
      }
  
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `python_certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const handleNavigation = (path: string) => {
    if (!user) {
      Swal.fire({
        icon: 'warning',
        title: 'Access Denied',
        text: 'Please login first to access this feature',
      });
    } else {
      router.push(path);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    document.cookie = 'auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    router.push("/");
  };

  const handleCodeSubmit = async (codeOutput: string) => {
    if (!selectedLesson || !userId) return;
    setIsLoading(true);

    const isCorrect = codeOutput.trim() === selectedLesson.test.expected_output;

    try {
      const progressResponse = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          lessonId: selectedLesson.id,
          courseId: 'python',
          completed: isCorrect,
          score: isCorrect ? 100 : 0,
        }),
      });

      if (!progressResponse.ok) throw new Error("Failed to update progress");

      if (isCorrect) {
        const pointsResponse = await fetch("/api/users/update-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, points: 10 }),
        });

        if (!pointsResponse.ok) throw new Error("Failed to update points");

        const userData = localStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          user.points = (user.points || 0) + 10;
          localStorage.setItem("user", JSON.stringify(user));
        }

        setProgress((prev) => ({
          ...prev,
          [selectedLesson.id]: true,
        }));

        Swal.fire({
          icon: "success",
          title: "Correct!",
          text: "You earned 10 points!",
          timer: 2000,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Incorrect answer. Try again.",
        });
      }
    } catch (error) {
      console.error("Error submitting code:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to submit code. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  const progressPercentage = pythonLessons.length > 0
    ? (Object.values(progress).filter(Boolean).length / pythonLessons.length) * 100
    : 0;

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navbarLeft}>
          <Link href="/">
            <div style={styles.logo}>Codium</div>
          </Link>
        </div>
        <div style={styles.navbarCenter}>
          <Link href="/">
            <div style={styles.navItem}>Home</div>
          </Link>
          <div style={styles.navItem} onClick={() => handleNavigation('/course')}>
            Courses
          </div>
          <div style={styles.navItem} onClick={() => handleNavigation('/htmlplayground')}>
            HTML Playground
          </div>
          <div style={styles.navItem} onClick={() => handleNavigation('/codingplayground')}>
            Coding Playground
          </div>
        </div>
        <div style={styles.navbarRight}>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </nav>

      <div style={styles.mainContainer}>
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={styles.toggleButton}
        >
          {sidebarOpen ? '×' : '☰'}
        </button>

        {/* Sidebar */}
        <div style={{
          ...styles.sidebar,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          width: sidebarOpen ? '300px' : '0'
        }}>
          <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarTitle}>Python Course</h2>
            
            <button 
              style={styles.resetButton}
              onClick={async () => {
                if (!userId) return;
                
                const { isConfirmed } = await Swal.fire({
                  title: 'Are you sure?',
                  text: "This will reset your Python progress!",
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#d33',
                  cancelButtonColor: '#3085d6',
                  confirmButtonText: 'Yes, reset it!'
                });

                if (isConfirmed) {
                  try {
                    setIsLoading(true);
                    const response = await fetch('/api/progress/reset', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId, courseId: 'python' })
                    });

                    if (!response.ok) throw new Error('Failed to reset progress');
                    setProgress({});
                    
                    const userData = localStorage.getItem("user");
                    if (userData) {
                      const user = JSON.parse(userData);
                      user.points = Math.max(0, (user.points || 0) - 10);
                      localStorage.setItem("user", JSON.stringify(user));
                    }

                    Swal.fire({
                      icon: 'success',
                      title: 'Reset!',
                      text: 'Your Python progress has been reset.',
                      timer: 2000
                    });
                  } catch (error) {
                    Swal.fire({
                      icon: 'error',
                      title: 'Error',
                      text: 'Failed to reset progress',
                    });
                  } finally {
                    setIsLoading(false);
                  }
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Resetting...' : 'Reset Progress'}
            </button>
          </div>

          <div style={styles.progressBar}>
            <div style={styles.progressText}>
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div style={styles.progressTrack}>
              <div 
                style={{
                  ...styles.progressFill,
                  width: `${progressPercentage}%`
                }}
              />
            </div>
          </div>

          <div style={{ padding: '0 20px' }}>
  {/* Certificate Button */}
  <button
    style={{
      ...styles.certificateButton,
      backgroundColor:
        hasCertificate || (pythonLessons.length > 0 && Object.values(progress).filter(Boolean).length === pythonLessons.length)
          ? styles.certificateButton.backgroundColor
          : '#cccccc'
    }}
    onClick={handleGenerateCertificate}
    disabled={
      !hasCertificate &&
      (pythonLessons.length === 0 || Object.values(progress).filter(Boolean).length !== pythonLessons.length)
    }
    title={
      pythonLessons.length > 0 && Object.values(progress).filter(Boolean).length !== pythonLessons.length
        ? `Complete ${pythonLessons.length - Object.values(progress).filter(Boolean).length} more lessons to unlock`
        : ''
    }
  >
    {hasCertificate ? 'Download Certificate' : 'Get Your Certificate'}
  </button>

  {/* Certificate Banner (shown when all lessons completed but no certificate yet) */}
  {!hasCertificate &&
    Object.values(progress).filter(Boolean).length === pythonLessons.length &&
    pythonLessons.length > 0 && (
      <div style={styles.certificateBanner}>
        <div style={styles.certificateTitle}>Course Completed!</div>
        <div style={styles.certificateText}>Congratulations! You've completed all python lessons.</div>
      </div>
    )}
</div>

          <div style={styles.lessonList}>
            {pythonLessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => {
                  setSelectedLesson(lesson);
                  if (window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                style={{
                  ...styles.lessonItem,
                  ...(selectedLesson?.id === lesson.id ? styles.lessonItemActive : {}),
                  ...(progress[lesson.id] ? styles.lessonItemCompleted : {})
                }}
              >
                <div style={styles.lessonItemContent}>
                  <h3 style={styles.lessonItemTitle}>{lesson.title}</h3>
                  <p style={styles.lessonItemDescription}>{lesson.description}</p>
                </div>
                {progress[lesson.id] && (
                  <span style={styles.completionCheck}>✓</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{
          ...styles.mainContent,
          marginLeft: sidebarOpen ? '300px' : '0'
        }}>
          <div style={styles.contentWrapper}>
            {/* Left side: Lesson Content */}
            <div style={styles.lessonContent}>
              {selectedLesson ? (
                <>
                  {progress[selectedLesson.id] && (
                    <div style={styles.completionBanner}>
                      You've completed this lesson!
                    </div>
                  )}
                  
                  <h1 style={styles.lessonTitle}>{selectedLesson.title}</h1>
                  
                  <div style={styles.lessonItems}>
                    {selectedLesson.content.map((item, index) => (
                      <div key={index} style={styles.lessonItem}>
                        {item.type === "text" ? (
                          <p style={styles.textContent}>{item.content}</p>
                        ) : (
                          <pre style={styles.codeBlock}>
                            <code style={styles.code}>{item.content}</code>
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={styles.noLessonSelected}>
                  Select a lesson from the sidebar to begin
                </div>
              )}
            </div>

            {/* Right side: Test Section */}
            {selectedLesson?.test && !progress[selectedLesson.id] && (
              <div style={styles.testSection}>
                <h2 style={styles.testTitle}>Test Your Knowledge</h2>
                <p style={styles.testQuestion}>{selectedLesson.test.question}</p>
                <p style={styles.outputHint}>Expected Output: {selectedLesson.test.expected_output}</p>
                
                <div style={styles.editorContainer}>
                  <PythonEditor 
                    defaultValue="# Write your code here"
                    onExecute={(output, error) => {
                      if (!error) {
                        setLastOutput(output);
                      } else {
                        Swal.fire({
                          icon: "error",
                          title: "Execution Error",
                          text: error,
                        });
                      }
                    }}
                    ref={editorRef}
                  />
                  
                  <div style={styles.buttonContainer}>
                    <button
                      onClick={() => {
                        if (lastOutput) {
                          handleCodeSubmit(lastOutput);
                        } else {
                          Swal.fire({
                            icon: "warning",
                            title: "No Output",
                            text: "Please run your code first before submitting",
                          });
                        }
                      }}
                      disabled={isLoading || progress[selectedLesson?.id]}
                      style={{
                        ...styles.submitButton,
                        ...(isLoading || progress[selectedLesson?.id] ? styles.buttonDisabled : {})
                      }}
                    >
                      {isLoading ? 'Submitting...' : 
                       progress[selectedLesson?.id] ? 'Completed ✓' : 
                       'Submit Solution'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(10px)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  navbarLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  navbarCenter: {
    display: 'flex',
    gap: '2rem',
  },
  navbarRight: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    fontSize: '1.8rem',
    fontWeight: '800',
    color: '#7c3aed',
    cursor: 'pointer',
  },
  navItem: {
    color: '#e2e8f0',
    cursor: 'pointer',
    padding: '0.5rem',
    transition: 'color 0.3s ease',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    color: '#f43f5e',
    border: '2px solid #f43f5e',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  mainContainer: {
    position: 'relative' as const,
    minHeight: 'calc(100vh - 64px)',
  },
  toggleButton: {
    position: 'fixed' as const,
    top: '80px',
    left: '20px',
    zIndex: 99,
    backgroundColor: '#1e293b',
    border: 'none',
    color: '#ffffff',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },
  sidebar: {
    position: 'fixed' as const,
    top: '64px',
    left: 0,
    height: 'calc(100vh - 64px)',
    backgroundColor: '#1e293b',
    transition: 'all 0.3s ease',
    overflowY: 'auto' as const,
    zIndex: 98,
    boxShadow: '4px 0 8px rgba(0, 0, 0, 0.2)',
  },
  sidebarHeader: {
    padding: '1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  outputHint: {
    color: '#94a3b8',
    fontSize: '0.9rem',
    padding: '0.5rem',
    backgroundColor: '#1f2937',
    borderRadius: '4px',
    marginBottom: '1rem',
    borderLeft: '4px solid #7c3aed',
  },
  sidebarTitle: {
    margin: '0 0 1rem 0',
    color: '#ffffff',
    fontSize: '1.5rem',
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: 'transparent',
    color: '#f43f5e',
    border: '1px solid #f43f5e',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.3s ease',
  },
  progressBar: {
    padding: '1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  progressText: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#94a3b8',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
  },
  progressTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: '#2d3748',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    transition: 'width 0.3s ease',
  },
  lessonList: {
    padding: '1rem',
  },
  lessonItem: {
    padding: '1rem',
    backgroundColor: '#2d3748',
    borderRadius: '8px',
    marginBottom: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  lessonItemActive: {
    backgroundColor: '#7c3aed',
  },
  lessonItemCompleted: {
    backgroundColor: '#065f46',
  },
  lessonItemContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  lessonItemTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: '500',
    color: '#ffffff',
  },
  lessonItemDescription: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#94a3b8',
  },
  completionCheck: {
    color: '#10b981',
    marginLeft: '0.5rem',
  },
  mainContent: {
    transition: 'margin-left 0.3s ease',
    minHeight: 'calc(100vh - 64px)',
    backgroundColor: '#0f172a',
  },
  contentWrapper: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
    padding: '2rem',
    maxWidth: '1800px',
    margin: '0 auto',
  },
  lessonContent: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '2rem',
    height: 'fit-content',
  },
  completionBanner: {
    backgroundColor: '#065f46',
    color: '#10b981',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1.5rem',
  },
  lessonTitle: {
    color: '#ffffff',
    fontSize: '2rem',
    fontWeight: '700',
    marginBottom: '2rem',
  },
  lessonItems: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  textContent: {
    color: '#94a3b8',
    lineHeight: '1.7',
    fontSize: '1rem',
    margin: 0,
  },
  codeBlock: {
    backgroundColor: '#2d3748',
    padding: '1rem',
    borderRadius: '8px',
    overflow: 'auto' as const,
    margin: 0,
  },
  code: {
    color: '#10b981',
    fontFamily: 'monospace',
  },
  testSection: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '2rem',
    height: 'fit-content',
  },
  testTitle: {
    color: '#ffffff',
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '1rem',
  },
  testQuestion: {
    color: '#94a3b8',
    marginBottom: '1.5rem',
    lineHeight: '1.6',
  },
  editorContainer: {
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  buttonContainer: {
    marginTop: '1rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  submitButton: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s ease',
  },
  buttonDisabled: {
    backgroundColor: '#4b5563',
    cursor: 'not-allowed',
  },
  noLessonSelected: {
    textAlign: 'center' as const,
    color: '#94a3b8',
    padding: '4rem 2rem',
  },
  certificateButton: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '10px 0',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: '#45a049',
    },
    '&:disabled': {
      backgroundColor: '#cccccc',
      cursor: 'not-allowed',
    }
  },

  certificateBanner: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '20px',
    borderRadius: '8px',
    margin: '20px 0',
    textAlign: 'center' as const,
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
  },

  certificateTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '10px'
  },

  certificateText: {
    fontSize: '16px',
    marginBottom: '15px'
  }
};
