"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Zap,
  TrendingUp,
  Bot,
  Copy,
  Layers
} from "lucide-react";

interface TVCScene {
  id: number;
  title: string;
  duration: number; // in seconds
  image: string;
  subtitle: string;
  voiceover: string;
  tagline: string;
  badge: string;
}

const TVC_SCENES: TVCScene[] = [
  {
    id: 1,
    title: "Nỗi Đau Bán Hàng & Quá Tải Tin Nhắn",
    duration: 6,
    image: "/tvc/scene1.jpg",
    badge: "01. NỖI ĐAU KHÁCH HÀNG",
    tagline: "BẠN ĐANG ĐÁNH MẤT KHÁCH HÀNG?",
    subtitle: "Khách hàng nhắn tin lúc 1 giờ sáng... Không ai trả lời. Hàng trăm đơn hàng trôi mất vào tay đối thủ!",
    voiceover: "Nửa đêm, khách hàng inbox ồ ạt nhưng không ai trả lời. Bạn mệt mỏi, nhân viên quá tải, và đơn hàng cứ thế rơi vào tay đối thủ?"
  },
  {
    id: 2,
    title: "TechMax AI Xuất Hiện - Trợ Lý Đa Kênh",
    duration: 7,
    image: "/tvc/scene2.jpg",
    badge: "02. GIẢI PHÁP ĐỘT PHÁ",
    tagline: "TECHMAX AI SYSTEM ACTIVATED",
    subtitle: "Nền tảng trợ lý AI cá nhân hóa - Tự động kết nối Zalo, Facebook Messenger và Threads 24/7!",
    voiceover: "Đừng lo lắng! Đã có TechMax AI - Nền tảng trợ lý AI thông minh kết nối Zalo, Facebook và Threads tự động 24/7."
  },
  {
    id: 3,
    title: "Phản Hồi Thần Tốc & Tự Động Hóa Vận Hành",
    duration: 8,
    image: "/tvc/scene3.jpg",
    badge: "03. SỨC MẠNH VẬN HÀNH",
    tagline: "TRẢ LỜI TRONG 0.5 GIÂY - CHỐT ĐƠN TỰ ĐỘNG",
    subtitle: "Tự động tư vấn tự nhiên như người thật. Nuôi nick, seeding, gửi chiến dịch marketing Zalo hàng loạt!",
    voiceover: "Tự động tư vấn như chuyên gia trong 0.5 giây. Tự động chốt đơn, gửi báo giá và chăm sóc hàng ngàn khách hàng cùng lúc mà không hề mệt mỏi."
  },
  {
    id: 4,
    title: "Bùng Nổ Doanh Số & Tự Do Tài Chính",
    duration: 6,
    image: "/tvc/scene4.jpg",
    badge: "04. KẾT QUẢ ĐỘT PHÁ",
    tagline: "TIẾT KIỆM 90% CHI PHÍ - DOANH THU X5",
    subtitle: "Hệ thống tự vận hành ngày đêm. Bạn thảnh thơi thưởng thức cà phê khi đơn hàng về liên tục!",
    voiceover: "Tiết kiệm 90% chi phí nhân sự. Tự do tận hưởng cuộc sống trong khi TechMax AI liên tục mang doanh số về cho bạn mọi lúc, mọi nơi."
  },
  {
    id: 5,
    title: "Kêu Gọi Hành Động (Call To Action)",
    duration: 6,
    image: "/tvc/scene5.jpg",
    badge: "05. HÀNH ĐỘNG NGAY",
    tagline: "TECHMAXAI.STORE - NỀN TẢNG AI SỐ 1",
    subtitle: "Trải nghiệm miễn phí ngay hôm nay tại: https://techmaxai.store",
    voiceover: "TechMax AI - Đột phá bán hàng tự động đa kênh. Truy cập ngay TechMax AI chấm store để trải nghiệm miễn phí hôm nay!"
  }
];

export default function TVCPage() {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isVoiceoverEnabled, setIsVoiceoverEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"player" | "storyboard" | "scripts">("player");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const sceneTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preloadedImagesRef = useRef<HTMLImageElement[]>([]);

  const totalDuration = TVC_SCENES.reduce((acc, s) => acc + s.duration, 0);

  // Preload all scene images
  useEffect(() => {
    preloadedImagesRef.current = TVC_SCENES.map((scene) => {
      const img = new Image();
      img.src = scene.image;
      return img;
    });
  }, []);

  // Web Audio Context for SFX
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Play synthetic cinematic sound effects
  const playSfx = (type: "transition" | "chime" | "whoosh") => {
    if (!isAudioEnabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      if (type === "whoosh") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.3);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.6);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === "chime") {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.001, now + i * 0.08);
          gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.8);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Play voiceover via Web Speech API in Vietnamese
  const speakVoiceover = (text: string) => {
    if (!isVoiceoverEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.includes("vi"));
    if (viVoice) utterance.voice = viVoice;

    window.speechSynthesis.speak(utterance);
  };

  // Render on canvas with Ken Burns zoom effect and overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let startTime: number | null = null;
    const currentScene = TVC_SCENES[currentSceneIdx];

    const render = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = (time - startTime) / 1000;
      const progressRatio = Math.min(elapsed / currentScene.duration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const img = preloadedImagesRef.current[currentSceneIdx];
      if (img && img.complete) {
        // Ken Burns effect: subtle scale from 1.0 to 1.15 and pan
        const zoom = 1.0 + progressRatio * 0.12;
        const panX = (progressRatio - 0.5) * 40;
        const panY = (progressRatio - 0.5) * 20;

        ctx.save();
        ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();
      } else {
        // Fallback gradient background
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, "#090d16");
        grad.addColorStop(1, "#030712");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Cinematic Vignette overlay
      const vignette = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 4,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 1.5
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bottom subtitle backdrop
      const bottomGrad = ctx.createLinearGradient(0, canvas.height - 240, 0, canvas.height);
      bottomGrad.addColorStop(0, "rgba(3, 7, 18, 0)");
      bottomGrad.addColorStop(0.5, "rgba(3, 7, 18, 0.85)");
      bottomGrad.addColorStop(1, "rgba(3, 7, 18, 0.98)");
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, canvas.height - 240, canvas.width, 240);

      // Badge tag
      ctx.save();
      ctx.fillStyle = "rgba(14, 165, 233, 0.25)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      const badgeX = 60;
      const badgeY = canvas.height - 180;
      ctx.roundRect(badgeX, badgeY, 260, 36, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(currentScene.badge, badgeX + 20, badgeY + 23);
      ctx.restore();

      // Tagline Header (Kinetic text)
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px sans-serif";
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 12;
      ctx.fillText(currentScene.tagline, 60, canvas.height - 115);
      ctx.restore();

      // Subtitle body text
      ctx.save();
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "20px sans-serif";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 8;
      ctx.fillText(currentScene.subtitle, 60, canvas.height - 65);
      ctx.restore();

      // Top Brand watermark
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("TECHMAX AI", 60, 60);

      ctx.fillStyle = "#06b6d4";
      ctx.font = "14px sans-serif";
      ctx.fillText("techmaxai.store", 60, 85);
      ctx.restore();

      if (isPlaying) {
        animFrame = requestAnimationFrame(render);
      }
    };

    animFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrame);
  }, [currentSceneIdx, isPlaying]);

  // Handle Scene Transitions & Progression
  useEffect(() => {
    if (!isPlaying) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    const currentScene = TVC_SCENES[currentSceneIdx];
    speakVoiceover(currentScene.voiceover);
    playSfx(currentSceneIdx === 4 ? "chime" : "whoosh");

    const intervalTime = 100;
    const totalSteps = (currentScene.duration * 1000) / intervalTime;
    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      const currentSceneProgress = step / totalSteps;
      const elapsedPrior = TVC_SCENES.slice(0, currentSceneIdx).reduce((acc, s) => acc + s.duration, 0);
      const overallSeconds = elapsedPrior + currentScene.duration * currentSceneProgress;
      setProgress((overallSeconds / totalDuration) * 100);

      if (step >= totalSteps) {
        clearInterval(interval);
        if (currentSceneIdx < TVC_SCENES.length - 1) {
          setCurrentSceneIdx((prev) => prev + 1);
        } else {
          // Finished TVC
          setIsPlaying(false);
          setProgress(100);
          if (isRecording && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
          }
        }
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlaying, currentSceneIdx, isRecording, isVoiceoverEnabled, isAudioEnabled, totalDuration]);

  // Start recording the canvas to MP4/WebM video
  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `techmax-ai-tvc-ads-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setCurrentSceneIdx(0);
      setProgress(0);
      setIsPlaying(true);
    } catch (err) {
      alert("Trình duyệt của bạn không hỗ trợ quay màn hình trực tiếp. Vui lòng thử trên Chrome hoặc Edge.");
    }
  };

  const copyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="text-white w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
              TechMax AI Studio - TVC Ads Generator
            </h1>
            <p className="text-xs text-slate-400">Video TVC Quảng Cáo & Kịch Bản Bán Hàng Đa Kênh Chuẩn Agency</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab("player")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === "player" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              TVC Player
            </button>
            <button
              onClick={() => setActiveTab("storyboard")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === "storyboard" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Storyboard
            </button>
            <button
              onClick={() => setActiveTab("scripts")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === "scripts" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Kịch Bản Ads
            </button>
          </div>

          <a
            href="https://techmaxai.store"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-md shadow-cyan-500/25"
          >
            techmaxai.store <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {activeTab === "player" && (
          <div className="space-y-6">
            {/* TVC Canvas Player Container */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl aspect-video max-w-5xl mx-auto group">
              <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-cover block" />

              {/* Center Big Play Button when paused */}
              {!isPlaying && (
                <div
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-cyan-500/50 hover:scale-110 transition-transform">
                    <Play className="w-9 h-9 text-white ml-1 fill-white" />
                  </div>
                </div>
              )}

              {/* Progress Bar Top */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800/80 z-20">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-100 ease-linear shadow-sm shadow-cyan-400"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* In-Video Bottom Controls Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-4 flex items-center justify-between z-20 opacity-90 hover:opacity-100 transition">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-600/30"
                    title={isPlaying ? "Tạm dừng" : "Phát TVC"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                  </button>

                  <button
                    onClick={() => {
                      setCurrentSceneIdx(0);
                      setProgress(0);
                      setIsPlaying(true);
                    }}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
                    title="Phát lại từ đầu"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <div className="text-xs font-mono text-slate-300 pl-2">
                    Cảnh {currentSceneIdx + 1}/{TVC_SCENES.length}:{" "}
                    <span className="text-cyan-400 font-semibold">{TVC_SCENES[currentSceneIdx].title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsVoiceoverEnabled(!isVoiceoverEnabled)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      isVoiceoverEnabled
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                        : "bg-slate-800/60 border-slate-700 text-slate-400"
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    {isVoiceoverEnabled ? "Giọng AI: BẬT" : "Giọng AI: TẮT"}
                  </button>

                  <button
                    onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                    className={`p-2 rounded-lg border transition ${
                      isAudioEnabled
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                        : "bg-slate-800/60 border-slate-700 text-slate-400"
                    }`}
                    title="Hiệu ứng âm thanh"
                  >
                    {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={startRecording}
                    disabled={isRecording}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-md shadow-emerald-600/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isRecording ? "Đang xuất video..." : "Xuất Video (WebM)"}
                  </button>
                </div>
              </div>
            </div>

            {/* Scene Thumbnails Navigation */}
            <div className="max-w-5xl mx-auto">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Các phân cảnh TVC (Nhấp để nhảy cảnh)
              </h3>
              <div className="grid grid-cols-5 gap-3">
                {TVC_SCENES.map((scene, idx) => (
                  <button
                    key={scene.id}
                    onClick={() => {
                      setCurrentSceneIdx(idx);
                      setIsPlaying(true);
                    }}
                    className={`group relative rounded-xl overflow-hidden border transition text-left ${
                      currentSceneIdx === idx
                        ? "border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/20"
                        : "border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700"
                    }`}
                  >
                    <img src={scene.image} alt={scene.title} className="w-full aspect-video object-cover" />
                    <div className="p-2 bg-slate-900/90 text-slate-300">
                      <div className="text-[10px] font-bold text-cyan-400">{scene.badge.split(".")[0]}</div>
                      <div className="text-xs font-medium truncate text-white">{scene.title}</div>
                      <div className="text-[10px] text-slate-500">{scene.duration}s</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Scene Script Highlight */}
            <div className="max-w-5xl mx-auto bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20">
                    PHÂN CẢNH {currentSceneIdx + 1}
                  </span>
                  <h4 className="text-sm font-bold text-white">{TVC_SCENES[currentSceneIdx].title}</h4>
                </div>
                <span className="text-xs text-slate-400">Thời lượng: {TVC_SCENES[currentSceneIdx].duration} giây</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold uppercase">Lời thoại Voiceover:</span>
                  <p className="text-slate-200 bg-slate-950 p-3 rounded-lg border border-slate-800/80 italic">
                    &ldquo;{TVC_SCENES[currentSceneIdx].voiceover}&rdquo;
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold uppercase">Phụ đề hiển thị (Visual Text):</span>
                  <p className="text-cyan-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-medium">
                    {TVC_SCENES[currentSceneIdx].subtitle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Storyboard Tab */}
        {activeTab === "storyboard" && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white">Bảng Phân Cảnh TVC Chi Tiết (Storyboard)</h2>
              <p className="text-sm text-slate-400">
                Chi tiết từng phân cảnh, góc máy quay, ánh sáng, âm thanh và chuyển cảnh chuẩn TVC truyền thông thương hiệu TechMax AI.
              </p>
            </div>

            <div className="space-y-6">
              {TVC_SCENES.map((scene, idx) => (
                <div
                  key={scene.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-center"
                >
                  <div className="lg:col-span-6 rounded-xl overflow-hidden border border-slate-800 shadow-md">
                    <img src={scene.image} alt={scene.title} className="w-full aspect-video object-cover" />
                  </div>
                  <div className="lg:col-span-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full">
                        CẢNH {idx + 1} ({scene.duration}s)
                      </span>
                      <span className="text-xs text-slate-500">{scene.badge}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white">{scene.title}</h3>

                    <div className="space-y-2 text-xs">
                      <div>
                        <strong className="text-slate-400 block mb-1">Góc quay & Visual:</strong>
                        <p className="text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                          {idx === 0 && "Góc máy trung (Medium Shot), ánh sáng đèn xanh neon và đỏ rực màn hình máy tính thể hiện sự căng thẳng, mệt mỏi ban đêm."}
                          {idx === 1 && "Góc quay toàn cảnh công nghệ cao (Sci-Fi wide shot), hologram TechMax phát sáng kết nối mạng nơ-ron đa kênh."}
                          {idx === 2 && "Góc máy lia nhanh (Whip pan), màn hình đồ thị tài chính nhảy vọt, tin nhắn chạy với tốc độ ánh sáng."}
                          {idx === 3 && "Góc máy cận (Close-up) doanh nhân thư thái mỉm cười trong tòa nhà cao tầng, ánh sáng ban mai rạng rỡ."}
                          {idx === 4 && "Cinematic 3D Outro, Logo TechMax AI phát sáng neon kim loại cùng link techmaxai.store nổi bật."}
                        </p>
                      </div>

                      <div>
                        <strong className="text-slate-400 block mb-1">Voiceover Thuyết Minh:</strong>
                        <p className="text-cyan-200 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 italic">
                          &ldquo;{scene.voiceover}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scripts Tab */}
        {activeTab === "scripts" && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white">Kịch Bản Quảng Cáo Đa Kênh (TikTok / Reels / Facebook Ads)</h2>
              <p className="text-sm text-slate-400">
                Các mẫu kịch bản quảng cáo tối ưu tỷ lệ chuyển đổi (CTR) sẵn sàng cho đội ngũ Media & Ads TechMax triển khai.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 30s TikTok/Reels Script */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-white">Kịch Bản 30s (TikTok / Reels Ads)</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Hook Mạnh - Tốc Độ Cao
                  </span>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong className="text-amber-400 block mb-1">00:00 - 00:03 [HOOK GIỮ CHÂN]:</strong>
                    &ldquo;Khách hỏi lúc 2 giờ sáng nhưng bạn ngủ quên? Bạn vừa mất đơn hàng trị giá 2 triệu đồng!&rdquo;
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong className="text-cyan-400 block mb-1">00:03 - 00:15 [GIẢI PHÁP TECHMAX AI]:</strong>
                    &ldquo;TechMax AI - Trợ lý bán hàng tự động 24/7 trên Zalo, Facebook và Threads. Trả lời chuẩn như chuyên gia trong 0.5 giây!&rdquo;
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong className="text-emerald-400 block mb-1">00:15 - 00:25 [TÍNH NĂNG VƯỢT TRỘI]:</strong>
                    &ldquo;Tự động nuôi tài khoản, seeding, gửi hàng ngàn tin nhắn chăm sóc khách hàng. Tiết kiệm 90% chi phí nhân viên!&rdquo;
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong className="text-indigo-400 block mb-1">00:25 - 00:30 [CALL TO ACTION]:</strong>
                    &ldquo;Nhấp vào link bên dưới hoặc truy cập techmaxai.store để kích hoạt bot AI miễn phí ngay!&rdquo;
                  </div>
                </div>

                <button
                  onClick={() =>
                    copyScript(
                      `[Kịch bản 30s TikTok/Reels TechMax AI]\n00:00 - 00:03: Khách hỏi lúc 2 giờ sáng nhưng bạn ngủ quên? Bạn vừa mất đơn hàng trị giá 2 triệu đồng!\n00:03 - 00:15: TechMax AI - Trợ lý bán hàng tự động 24/7 trên Zalo, Facebook và Threads. Trả lời chuẩn như chuyên gia trong 0.5 giây!\n00:15 - 00:25: Tự động nuôi tài khoản, seeding, gửi hàng ngàn tin nhắn chăm sóc khách hàng. Tiết kiệm 90% chi phí nhân viên!\n00:25 - 00:30: Nhấp vào link hoặc truy cập https://techmaxai.store để kích hoạt bot AI miễn phí ngay!`
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Đã sao chép!" : "Sao chép kịch bản 30s"}
                </button>
              </div>

              {/* 60s Facebook/YouTube Ads Script */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-bold text-white">Kịch Bản 60s (Facebook & YouTube Ads)</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Chuyển Đổi Chuyên Sâu
                  </span>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong className="text-cyan-400 block mb-1">00:00 - 00:10 [VẤN ĐỀ CHỦ SHOP]:</strong>
                    &ldquo;Bạn đang kinh doanh online và đau đầu vì chi phí thuê trực page quá tốn kém? Khách hàng nhắn tin ban đêm thì bỏ đi vì đợi quá lâu?&rdquo;
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong className="text-indigo-400 block mb-1">00:10 - 00:25 [ĐỘT PHÁ TỰ ĐỘNG HÓA]:</strong>
                    &ldquo;Đã đến lúc để TechMax AI làm việc thay bạn! Nền tảng AI đột phá kết hợp sức mạnh mô hình ngôn ngữ lớn để trả lời khách tự nhiên, chuẩn kịch bản kinh doanh.&rdquo;
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong className="text-emerald-400 block mb-1">00:25 - 00:45 [TÍNH NĂNG TOÀN DIỆN]:</strong>
                    &ldquo;Không chỉ trực chat, TechMax AI còn có bộ công cụ Facebook Auto, Threads Auto, Zalo Campaign tự động quét tệp, kết bạn, seeding và gửi tin nhắn khuyến mãi hàng loạt!&rdquo;
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong className="text-amber-400 block mb-1">00:45 - 01:00 [ƯU ĐÃI & CTA]:</strong>
                    &ldquo;Hàng ngàn chủ shop đã tăng gấp 5 lần doanh thu với TechMax AI. Đăng ký trải nghiệm miễn phí ngay tại techmaxai.store!&rdquo;
                  </div>
                </div>

                <button
                  onClick={() =>
                    copyScript(
                      `[Kịch bản 60s Facebook/YouTube Ads TechMax AI]\n00:00 - 00:10: Bạn đang kinh doanh online và đau đầu vì chi phí thuê trực page quá tốn kém? Khách hàng nhắn tin ban đêm thì bỏ đi vì đợi quá lâu?\n00:10 - 00:25: Đã đến lúc để TechMax AI làm việc thay bạn! Nền tảng AI đột phá kết hợp sức mạnh mô hình ngôn ngữ lớn để trả lời khách tự nhiên, chuẩn kịch bản kinh doanh.\n00:25 - 00:45: Không chỉ trực chat, TechMax AI còn có bộ công cụ Facebook Auto, Threads Auto, Zalo Campaign tự động quét tệp, kết bạn, seeding và gửi tin nhắn khuyến mãi hàng loạt!\n00:45 - 01:00: Hàng ngàn chủ shop đã tăng gấp 5 lần doanh thu với TechMax AI. Đăng ký trải nghiệm miễn phí ngay tại https://techmaxai.store!`
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Đã sao chép!" : "Sao chép kịch bản 60s"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        © 2026 TechMax AI. All rights reserved. Website chính thức:{" "}
        <a href="https://techmaxai.store" className="text-cyan-400 hover:underline">
          https://techmaxai.store
        </a>
      </footer>
    </div>
  );
}
