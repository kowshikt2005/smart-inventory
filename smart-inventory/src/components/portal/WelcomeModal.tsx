"use client";

import { useState } from "react";
import { X, Play } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WelcomeModalProps {
  customerName?: string;
  onClose: () => void;
}

export function WelcomeModal({ customerName, onClose }: WelcomeModalProps) {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2D2A5E] to-[#1E1B4B] px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-1">
                Welcome to SBE Portal
              </p>
              <h2 className="text-white text-lg font-bold">
                {customerName ? `Hello, ${customerName}!` : "Hello!"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors rounded-lg p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-gray-600 text-sm leading-relaxed">
              Thank you for using the <span className="font-semibold text-gray-800">Sri Balaji Enterprises</span> ordering portal.
              Here&apos;s a quick guide to get you started:
            </p>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2.5">
              <p className="text-sm font-semibold text-indigo-900">How to place an order:</p>
              <ol className="text-sm text-indigo-800 space-y-1.5 list-decimal list-inside">
                <li>Browse brands from the <span className="font-medium">sidebar</span> on the left</li>
                <li>Select a brand to see product ranges (sub-brands)</li>
                <li>Click on a range to view available products</li>
                <li>Click <span className="font-medium">&quot;Add to Cart&quot;</span> on the products you need</li>
                <li>Go to <span className="font-medium">Cart</span> to review &amp; adjust quantities</li>
                <li>Click <span className="font-medium">&quot;Place Order&quot;</span> to submit your order</li>
              </ol>
            </div>

            {/* Video section */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800">Watch a quick tutorial:</p>
              {!showVideo ? (
                <button
                  onClick={() => setShowVideo(true)}
                  className="w-full group relative bg-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center hover:bg-gray-800 transition-colors"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="h-6 w-6 text-[#1E1B4B] ml-0.5" />
                    </div>
                    <span className="text-white/60 text-sm">Click to play video</span>
                  </div>
                </button>
              ) : (
                <div className="rounded-xl overflow-hidden bg-black">
                  <video
                    src="/sbe-customer.mp4"
                    preload="metadata"
                    controls
                    autoPlay
                    className="w-full aspect-video"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="bg-[#272462] hover:bg-[#1E1B4B] text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
            >
              Start Shopping
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
