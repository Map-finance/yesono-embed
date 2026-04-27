import React from "react";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

const GRADIENTS = [
  "from-purple-500 to-orange-500",
  "from-pink-500 to-purple-500",
  "from-indigo-500 to-purple-500",
  "from-cyan-500 to-blue-500",
  "from-green-500 to-emerald-500",
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 32, className = "" }) => {
  const seed = (name || "user").trim();
  const letter = seed.charAt(0).toUpperCase() || "U";
  const gradient = pickGradient(seed);
  const style = { width: size, height: size, fontSize: Math.max(10, size / 2.5) };

  if (src) {
    return (
      <img
        src={src}
        alt={name || "avatar"}
        style={style}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={style}
      className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-semibold ${className}`}
    >
      {letter}
    </div>
  );
};

export default Avatar;
