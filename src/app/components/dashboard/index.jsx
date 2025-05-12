'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle, 
  Mic, 
  User, 
  Moon, 
  Sun, 
  Play, 
  Square, 
  Loader2 
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";

const Dashboard = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recordingStatus, setRecordingStatus] = useState('');
    const [audioUrl, setAudioUrl] = useState(null);
    const [apiResult, setApiResult] = useState(null);
    const [animationActive, setAnimationActive] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [email, setEmail] = useState('');
    const [emailInput, setEmailInput] = useState('');
    
    const { theme, setTheme } = useTheme();
    
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioRef = useRef(null);
    const visualizerRef = useRef(null);
    const animationFrameRef = useRef(null);
    const analyserRef = useRef(null);

    // Load email from localStorage on component mount
    useEffect(() => {
        const savedEmail = localStorage.getItem('userEmail');
        if (savedEmail) {
            setEmail(savedEmail);
        }
        
        // Delayed animation for a smoother entrance
        setTimeout(() => {
            setAnimationActive(true);
        }, 300);
        
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    const handleEmailSubmit = (e) => {
        e.preventDefault();
        if (emailInput && emailInput.includes('@')) {
            localStorage.setItem('userEmail', emailInput);
            setEmail(emailInput);
            setShowEmailModal(false);
            
            toast.success("Email saved", {
                description: `You're now using ${emailInput}`,
            });
        }
    };

    // Setup audio visualizer
    const setupVisualizer = (stream) => {
        if (!visualizerRef.current) return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        
        source.connect(analyser);
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const canvas = visualizerRef.current;
        const canvasCtx = canvas.getContext('2d');
        
        const draw = () => {
            if (!isRecording) return;
            
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            
            // Use theme-aware colors
            const isDark = theme === 'dark';
            canvasCtx.fillStyle = isDark ? '#1a1a1a' : '#f0f0f0';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
                if (isDark) {
                    gradient.addColorStop(0, '#6366f1'); // indigo-500
                    gradient.addColorStop(1, '#8b5cf6'); // violet-500
                } else {
                    gradient.addColorStop(0, '#4f46e5'); // indigo-600
                    gradient.addColorStop(1, '#7c3aed'); // violet-600
                }
                
                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    };

    const startRecording = async () => {
        try {
            // Check if email is set
            if (!email) {
                setShowEmailModal(true);
                return;
            }
            
            // Clear previous recording if exists
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }
            
            // Reset API result
            setApiResult(null);
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsRecording(true);
            setRecordingStatus('Recording your voice...');
            
            toast("Recording started", {
                description: "Speak clearly into your microphone",
            });
            
            // Setup visualizer with the stream
            setupVisualizer(stream);
            
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorder.onstop = handleRecordingStop;
            mediaRecorder.start();
        } catch (error) {
            console.error('Error starting recording:', error);
            setRecordingStatus('Microphone access denied');
            
            toast.error("Error", {
                description: "Microphone access denied. Please check your permissions.",
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsProcessing(true);
            setRecordingStatus('Processing recording...');
            
            toast("Recording stopped", {
                description: "Processing your audio...",
            });
            
            // Stop all tracks on the stream
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            
            // Stop animation frame
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }
    };

    const handleRecordingStop = async () => {
        try {
            // Create audio blob from recorded chunks
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            
            // Create URL for the audio blob for playback
            const url = URL.createObjectURL(audioBlob);
            setAudioUrl(url);
            setRecordingStatus('Sending to API...');
            
            // Create FormData to send the file
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.mp3');
            
            // Send to API
            setApiResult("Sending your audio to the API...");
            
            try {
                const response = await fetch(`https://176.9.16.194:9100/gemini_voice_agent/agent/?email=${email}`, {
                    method: 'POST',
                    body: formData,
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setApiResult(data);
                    setRecordingStatus('API request successful!');
                    
                    toast.success("Success", {
                        description: "Your recording was processed successfully",
                    });
                } else {
                    throw new Error(`API responded with status: ${response.status}`);
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                setApiResult(`Error: Could not process the request. ${apiError.message}`);
                setRecordingStatus('API request failed');
                
                toast.error("API Error", {
                    description: "Could not process your recording. Please try again.",
                });
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            setRecordingStatus('Error processing recording');
            setApiResult("Error: Could not process the audio recording.");
            
            toast.error("Error", {
                description: "Failed to process the recording",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const playRecording = () => {
        if (audioRef.current && audioUrl) {
            audioRef.current.play();
            
            toast("Playing", {
                description: "Playing your recorded audio",
            });
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <div className="min-h-screen min-w-screen bg-gradient-to-br from-background via-background/95 to-background/90 flex flex-col p-0 m-0 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
                <div className="absolute top-1/4 left-1/4 w-60 h-60 bg-accent/5 rounded-full blur-3xl" />
            </div>
            
            {/* Theme Switcher */}
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-5 right-16 z-10 rounded-full"
                onClick={toggleTheme}
            >
                {theme === 'dark' ? (
                    <Sun className="h-5 w-5 text-yellow-400" />
                ) : (
                    <Moon className="h-5 w-5 text-slate-700" />
                )}
                <span className="sr-only">Toggle theme</span>
            </Button>
            
            {/* User Icon */}
            <div className="absolute top-5 right-5 z-10">
                <Avatar 
                    onClick={() => setShowEmailModal(true)}
                    className="cursor-pointer hover:scale-110 transition-transform border border-border bg-card shadow-md"
                >
                    <AvatarFallback>
                        <User className="h-5 w-5 text-primary" />
                    </AvatarFallback>
                </Avatar>
            </div>
            
            {/* Email Status Indicator */}
            <AnimatePresence>
                {email && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Badge 
                            variant="outline" 
                            className="absolute top-5 left-5 z-10 bg-primary/10 text-primary border-primary shadow-sm"
                        >
                            <span className="opacity-80 mr-1">Logged in as:</span> {email}
                        </Badge>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Email Modal */}
            <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-primary">Enter Your Email</DialogTitle>
                        <DialogDescription>
                            We'll use this email to identify your recordings.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleEmailSubmit}>
                        <div className="grid gap-4 py-4">
                            <Input
                                type="email"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                placeholder="your.email@example.com"
                                required
                                className="focus-visible:ring-primary"
                            />
                        </div>
                        
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            
            <motion.div 
                className="flex-1 p-10 flex flex-col items-center justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                    opacity: animationActive ? 1 : 0, 
                    y: animationActive ? 0 : 20 
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                <Card className="w-full max-w-3xl shadow-lg border-border backdrop-blur-sm bg-card/90 overflow-hidden">
                    <CardHeader className="border-b border-border/40">
                        <CardTitle className="text-center text-2xl bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent font-bold">
                            Voice Recording Dashboard
                        </CardTitle>
                    </CardHeader>
                    
                    <CardContent className="p-6">
                        {/* Audio Visualizer */}
                        <motion.div 
                            className="w-full h-[140px] mb-5 rounded-lg overflow-hidden bg-muted/50 flex justify-center items-center border border-border/30 shadow-inner"
                            whileHover={{ scale: 1.01 }}
                            transition={{ duration: 0.2 }}
                        >
                            {isRecording ? (
                                <canvas 
                                    ref={visualizerRef} 
                                    width="700" 
                                    height="140" 
                                    className="w-full h-full"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-muted-foreground">
                                    <Mic className="h-12 w-12 mb-3 text-primary/70" />
                                    <p className="text-sm font-medium">Press Start to Record</p>
                                </div>
                            )}
                        </motion.div>

                        <AnimatePresence>
                            {apiResult && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="bg-card p-4 rounded-lg mt-5 border border-border/50 shadow-sm"
                                >
                                    <h3 className="mb-2 text-primary font-medium flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        API Result
                                    </h3>
                                    <Separator className="my-2" />
                                    <pre className="whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-md max-h-[300px] overflow-auto text-sm font-mono">
                                        {typeof apiResult === 'string' 
                                            ? apiResult 
                                            : JSON.stringify(apiResult, null, 2)}
                                    </pre>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        <AnimatePresence>
                            {recordingStatus && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    className={`p-3 rounded-lg mt-5 text-center border flex items-center justify-center gap-2 shadow-sm ${
                                        isRecording 
                                            ? 'bg-destructive/10 text-destructive border-destructive/50' 
                                            : 'bg-primary/10 text-primary border-primary/50'
                                    }`}
                                >
                                    {isRecording && (
                                        <span className="w-3 h-3 bg-destructive rounded-full inline-block animate-pulse"></span>
                                    )}
                                    {isProcessing && (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    )}
                                    {recordingStatus}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                    
                    <CardFooter className="flex justify-center gap-4 p-6 pt-2 border-t border-border/40 bg-muted/20">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button 
                                onClick={startRecording}
                                disabled={isRecording || isProcessing}
                                variant="default"
                                className="rounded-full shadow-md flex gap-2 px-6"
                                size="lg"
                            >
                                <Mic className="h-4 w-4" />
                                Start Recording
                            </Button>
                        </motion.div>
                        
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button 
                                onClick={stopRecording}
                                disabled={!isRecording || isProcessing}
                                variant="destructive"
                                className="rounded-full shadow-md flex gap-2 px-6"
                                size="lg"
                            >
                                <Square className="h-4 w-4" />
                                Stop Recording
                            </Button>
                        </motion.div>
                        
                        {audioUrl && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.05 }} 
                                whileTap={{ scale: 0.95 }}
                            >
                                <Button 
                                    onClick={playRecording}
                                    variant="secondary"
                                    className="rounded-full shadow-md flex gap-2 px-6"
                                    size="lg"
                                >
                                    <Play className="h-4 w-4" />
                                    Play Recording
                                </Button>
                                
                                <audio ref={audioRef} src={audioUrl} className="hidden" />
                            </motion.div>
                        )}
                    </CardFooter>
                </Card>
            </motion.div>
            
            <Toaster richColors position="top-right" />
        </div>
    );
};

export default Dashboard;