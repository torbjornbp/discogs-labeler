import { memo, useEffect, useRef, useState } from "react";
import PrintSheet from "./PrintSheet.jsx";

// Renders PrintSheet only when it is near the viewport. This keeps a large
// collection from generating thousands of QR codes and label cells at once.
function LazySheet({ eager = false, ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(
    () => eager || typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} style={{ width: props.template.pageW, height: props.template.pageH }}>
      {visible ? <PrintSheet {...props} /> : null}
    </div>
  );
}

export default memo(LazySheet);
