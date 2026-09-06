export function VideoPlayer({ src, className = "" }: { src: string; className?: string }) {
  return (
    <video
      src={src}
      controls
      playsInline
      className={`aspect-[9/16] w-full rounded-xl bg-black object-cover ${className}`}
    />
  );
}
