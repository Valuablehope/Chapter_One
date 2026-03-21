import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { storeService } from '../services/storeService';

export default function SplashScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, setLoading } = useAuthStore();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Initializing...');
  const [storeName, setStoreName] = useState(localStorage.getItem('store-name') || 'Supermarket');

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      try {
        const settings = await storeService.getDefaultStore();
        if (settings && settings.name) {
          setStoreName(settings.name);
          localStorage.setItem('store-name', settings.name);
        }
      } catch (e) {
        // Fallback handled
      }

      // Progressive loading stages
      const stages = [
        { progress: 20, message: 'Initializing...' },
        { progress: 40, message: 'Connecting to server...' },
        { progress: 60, message: 'Loading workspace...' },
        { progress: 80, message: 'Verifying credentials...' },
        { progress: 95, message: 'Almost ready...' },
      ];

      // Simulate progressive loading
      for (const stage of stages) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setLoadingProgress(stage.progress);
        setLoadingStage(stage.message);
      }

      // Final delay for visual effect
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (isAuthenticated) {
        try {
          const response = await authService.verifyToken();
          if (response.success) {
            // Update store with latest user info and token
            useAuthStore.getState().login(response.data.user as any, response.data.token);
            setLoadingProgress(100);
            setLoadingStage('Welcome back!');
            await new Promise((resolve) => setTimeout(resolve, 300));
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (error) {
          useAuthStore.getState().logout();
        }
      }

      // No token or invalid token, go to login
      setLoadingProgress(100);
      setLoadingStage('Redirecting...');
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigate('/login', { replace: true });
    };

    checkAuth();
  }, [navigate, isAuthenticated, setLoading]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 bg-gray-50 opacity-50"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center px-6 w-full max-w-2xl">
        {/* Logo Container with Modern Design */}
        <div className="mb-12 animate-scale-in">
          <div className="relative mx-auto w-32 h-32 mb-6">
            {/* Outer Glow Ring */}
            <div className="absolute inset-0 rounded-3xl bg-secondary-500 opacity-20 blur-xl animate-pulse-slow"></div>

            {/* Logo Container */}
            <div className="relative w-full h-full bg-white rounded-3xl shadow-2xl border-2 border-gray-200 flex items-center justify-center transform transition-all duration-500 hover:scale-105 hover:rotate-3 p-3">
              {/* Logo Icon */}
              <img
                src="icon.png"
                alt="Supermarket POS Logo"
                className="w-full h-full object-contain animate-float"
              />
            </div>

            {/* Orbiting Particles */}
            <div className="absolute inset-0 animate-spin-slow">
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-secondary-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-secondary-400 rounded-full transform -translate-x-1/2 translate-y-1/2"></div>
            </div>
          </div>
        </div>

        {/* App Name */}
        <div className="mb-4 animate-slide-up">
          <h1 className="text-6xl md:text-7xl font-extrabold text-secondary-500 mb-3 tracking-tight">
            {storeName}
          </h1>
          <div className="h-1 w-32 mx-auto bg-secondary-500 rounded-full mb-4"></div>
          <p className="text-xl md:text-2xl text-gray-600 font-semibold tracking-wide">
            Point of Sale System
          </p>
        </div>

        {/* Loading Section with Modern Card */}
        <div className="mt-16 px-8 py-6 bg-white rounded-2xl border-2 border-gray-100 shadow-xl animate-fade-in-delayed">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-gray-700">{loadingStage}</span>
              <span className="text-sm font-bold text-secondary-500">{loadingProgress}%</span>
            </div>

            {/* Progress Bar Container */}
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary-500 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                style={{ width: `${loadingProgress}%` }}
              >
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </div>

          {/* Loading Dots */}
          <div className="flex justify-center items-center space-x-2">
            <div className="w-2.5 h-2.5 bg-secondary-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2.5 h-2.5 bg-secondary-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2.5 h-2.5 bg-secondary-300 rounded-full animate-bounce"></div>
          </div>
        </div>

        {/* Version/Footer Info */}
        <div className="mt-12 animate-fade-in-delayed-2">
          <p className="text-sm text-gray-500 font-semibold">
            Professional • Secure • Efficient
          </p>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        
        .animate-scale-in {
          animation: scaleIn 0.8s ease-out;
        }
        
        .animate-slide-up {
          animation: slideUp 0.8s ease-out 0.2s both;
        }
        
        .animate-fade-in-delayed {
          animation: fadeIn 0.8s ease-out 0.4s both;
        }
        
        .animate-fade-in-delayed-2 {
          animation: fadeIn 0.8s ease-out 0.6s both;
        }
        
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
