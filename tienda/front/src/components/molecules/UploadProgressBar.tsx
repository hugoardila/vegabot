interface UploadProgressBarProps {
  progress: number;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
}) => {
  return (
    <div className="px-5 py-3 bg-primary/5 border-b border-black/5 dark:border-white/10">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-black/70 dark:text-white/70">
          Subiendo video...
        </span>
        <span className="text-xs font-black text-primary">{progress}%</span>
      </div>
      <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
