'use client'

import React, { useState, useRef, useEffect } from 'react';

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
        setAnimationActive(true);
        
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
            
            canvasCtx.fillStyle = '#000';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#00c6ff');
                gradient.addColorStop(1, '#0072ff');
                
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
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsProcessing(true);
            setRecordingStatus('Processing recording...');
            
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
                } else {
                    throw new Error(`API responded with status: ${response.status}`);
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                setApiResult(`Error: Could not process the request. ${apiError.message}`);
                setRecordingStatus('API request failed');
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            setRecordingStatus('Error processing recording');
            setApiResult("Error: Could not process the audio recording.");
        } finally {
            setIsProcessing(false);
        }
    };

    const playRecording = () => {
        if (audioRef.current && audioUrl) {
            audioRef.current.play();
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: '100vh',
            padding: 0,
            margin: 0,
            backgroundColor: '#121212',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            transition: 'all 0.3s ease',
            position: 'relative'
        }}>
            {/* User Icon */}
            <div 
                onClick={() => setShowEmailModal(true)}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#1e1e1e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                    border: '1px solid #333',
                    zIndex: 10,
                    transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12Z" stroke="#00c6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 21C20 18.87 19.1 16.84 17.5 15.34C15.9 13.84 13.77 13 11.5 13C9.23 13 7.1 13.84 5.5 15.34C3.9 16.84 3 18.87 3 21" stroke="#00c6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
            
            {/* Email Status Indicator */}
            {email && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(0, 198, 255, 0.1)',
                    border: '1px solid #00c6ff',
                    color: '#00c6ff',
                    fontSize: '12px',
                    zIndex: 10
                }}>
                    <span style={{ opacity: 0.8 }}>Logged in as:</span> {email}
                </div>
            )}
            
            {/* Email Modal */}
            {showEmailModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        backgroundColor: '#1e1e1e',
                        padding: '30px',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                        width: '90%',
                        maxWidth: '400px',
                        border: '1px solid #333',
                        animation: 'scaleIn 0.3s ease'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <h2 style={{
                                margin: 0,
                                color: '#00c6ff'
                            }}>Enter Your Email</h2>
                            <button 
                                onClick={() => setShowEmailModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#666',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    padding: '0',
                                    lineHeight: '1'
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                        <form onSubmit={handleEmailSubmit}>
                            <input
                                type="email"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                placeholder="your.email@example.com"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    fontSize: '16px',
                                    backgroundColor: '#252525',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    color: 'white',
                                    marginBottom: '20px'
                                }}
                                required
                            />
                            
                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '10px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setShowEmailModal(false)}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#333',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '10px 20px',
                                        background: 'linear-gradient(45deg, #00c6ff, #0072ff)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <div style={{ 
                flex: 1, 
                padding: '40px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: animationActive ? 1 : 0,
                transform: animationActive ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.8s ease, transform 0.8s ease'
            }}>
                <div style={{
                    maxWidth: '800px',
                    width: '100%',
                    padding: '30px',
                    backgroundColor: '#1e1e1e',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    marginBottom: '30px',
                    border: '1px solid #333',
                    transition: 'all 0.3s ease'
                }}>
                    <h1 style={{
                        textAlign: 'center',
                        fontSize: '28px',
                        marginBottom: '20px',
                        background: 'linear-gradient(45deg, #00c6ff, #0072ff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 'bold'
                    }}>Voice Recording Dashboard</h1>
                    
                    {/* Audio Visualizer */}
                    <div style={{
                        width: '100%',
                        height: '120px',
                        marginBottom: '20px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        backgroundColor: '#000',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        {isRecording ? (
                            <canvas 
                                ref={visualizerRef} 
                                width="700" 
                                height="120" 
                                style={{ width: '100%', height: '100%' }}
                            />
                        ) : (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666'
                            }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 15C13.66 15 15 13.66 15 12V5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V12C9 13.66 10.34 15 12 15Z" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M19 10V12C19 16.42 15.42 20 11 20C6.58 20 3 16.42 3 12V10" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M12 20V22" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <p style={{ marginTop: '10px', fontSize: '14px' }}>Press Start to Record</p>
                            </div>
                        )}
                    </div>

                    {apiResult && (
                        <div style={{
                            backgroundColor: '#252525',
                            padding: '15px',
                            borderRadius: '8px',
                            marginTop: '20px',
                            border: '1px solid #333',
                            animation: 'fadeIn 0.5s ease'
                        }}>
                            <h3 style={{ 
                                marginBottom: '10px',
                                color: '#00c6ff'
                            }}>API Result</h3>
                            <pre style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                backgroundColor: '#1a1a1a',
                                padding: '15px',
                                borderRadius: '4px',
                                maxHeight: '300px',
                                overflow: 'auto',
                                color: '#ddd',
                                fontSize: '14px',
                                fontFamily: 'monospace'
                            }}>
                                {typeof apiResult === 'string' 
                                    ? apiResult 
                                    : JSON.stringify(apiResult, null, 2)}
                            </pre>
                        </div>
                    )}
                    
                    {recordingStatus && (
                        <div style={{
                            padding: '12px 20px',
                            backgroundColor: isRecording ? 'rgba(255, 75, 75, 0.2)' : 'rgba(0, 114, 255, 0.2)',
                            color: isRecording ? '#ff4b4b' : '#0072ff',
                            borderRadius: '8px',
                            marginTop: '20px',
                            textAlign: 'center',
                            border: `1px solid ${isRecording ? '#ff4b4b' : '#0072ff'}`,
                            animation: 'pulse 2s infinite ease-in-out'
                        }}>
                            <span style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}>
                                {isRecording && (
                                    <span style={{
                                        width: '12px',
                                        height: '12px',
                                        backgroundColor: '#ff4b4b',
                                        borderRadius: '50%',
                                        display: 'inline-block',
                                        animation: 'blink 1s infinite'
                                    }}></span>
                                )}
                                {recordingStatus}
                            </span>
                        </div>
                    )}
                    
                    {/* Control Buttons */}
                    <div style={{ 
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '15px',
                        marginTop: '30px'
                    }}>
                        <button 
                            onClick={startRecording}
                            disabled={isRecording || isProcessing}
                            style={{ 
                                padding: '12px 24px',
                                background: isRecording || isProcessing ? '#333' : 'linear-gradient(45deg, #00c6ff, #0072ff)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '30px',
                                cursor: isRecording || isProcessing ? 'not-allowed' : 'pointer',
                                opacity: isRecording || isProcessing ? 0.7 : 1,
                                fontWeight: 'bold',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 15px rgba(0, 114, 255, 0.3)'
                            }}
                        >
                            Start Recording
                        </button>
                        
                        <button 
                            onClick={stopRecording}
                            disabled={!isRecording || isProcessing}
                            style={{ 
                                padding: '12px 24px',
                                background: !isRecording || isProcessing ? '#333' : 'linear-gradient(45deg, #ff4b4b, #ff0000)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '30px',
                                cursor: !isRecording || isProcessing ? 'not-allowed' : 'pointer',
                                opacity: !isRecording || isProcessing ? 0.7 : 1,
                                fontWeight: 'bold',
                                transition: 'all 0.3s ease',
                                boxShadow: !isRecording ? 'none' : '0 4px 15px rgba(255, 0, 0, 0.3)'
                            }}
                        >
                            Stop Recording
                        </button>
                        
                        {audioUrl && (
                            <>
                                <button 
                                    onClick={playRecording}
                                    style={{ 
                                        padding: '12px 24px',
                                        background: 'linear-gradient(45deg, #00d2ff, #3a7bd5)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '30px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 4px 15px rgba(0, 210, 255, 0.3)'
                                    }}
                                >
                                    Play Recording
                                </button>
                                
                                <audio ref={audioRef} src={audioUrl} style={{ display: 'none' }} />
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            <style jsx global>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
                
                @keyframes blink {
                    0% { opacity: 1; }
                    50% { opacity: 0.3; }
                    100% { opacity: 1; }
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;