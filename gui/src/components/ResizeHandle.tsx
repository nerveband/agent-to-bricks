import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastPos.current = direction === "horizontal" ? e.clientX : e.clientY;
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const pos = direction === "horizontal" ? ev.clientX : ev.clientY;
        const delta = pos - lastPos.current;
        lastPos.current = pos;
        onResize(delta);
      };

      const handleMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [direction, onResize]
  );

  const isHorizontal = direction === "horizontal";

  return (
    <div
      onMouseDown={handleMouseDown}
      className="group relative flex-shrink-0"
      style={{
        width: isHorizontal ? 4 : "100%",
        height: isHorizontal ? "100%" : 4,
        cursor: isHorizontal ? "col-resize" : "row-resize",
        zIndex: 50,
      }}
    >
      <div
        className="absolute transition-opacity opacity-0 group-hover:opacity-80"
        style={{
          background: "var(--yellow)",
          ...(isHorizontal
            ? { width: 2, height: "100%", left: 1, top: 0 }
            : { height: 2, width: "100%", top: 1, left: 0 }),
        }}
      />
    </div>
  );
}
