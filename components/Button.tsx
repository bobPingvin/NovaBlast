import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
  label?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  icon, 
  label, 
  className = '', 
  children,
  ...props 
}) => {
  const baseStyles = "cursor-pointer flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_0_rgb(55,48,163)] active:shadow-none active:translate-y-[4px]",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100 shadow-[0_4px_0_rgb(30,41,59)] active:shadow-none active:translate-y-[4px]",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_0_rgb(159,18,57)] active:shadow-none active:translate-y-[4px]",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white"
  };

  return (
    <button 
      type="button"
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      {label && <span>{label}</span>}
      {children}
    </button>
  );
};