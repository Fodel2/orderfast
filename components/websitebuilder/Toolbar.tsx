import clsx from "clsx";
import type { CSSProperties, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

interface ToolbarProps {
  children: ReactNode;
  className?: string;
  proxy?: boolean;
  style?: CSSProperties;
}

interface ToolbarSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

interface ToolbarButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  active?: boolean;
}

const ToolbarRoot = ({ children, className, proxy = false, style }: ToolbarProps) => {
  return (
    <div className={clsx("wb-toolbar", proxy && "wb-toolbar-proxy", className)} style={style}>
      <div className="website-toolbar">{children}</div>

      <style jsx>{`
        .website-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          max-width: 1200px;
          position: relative;
          z-index: 10;
          flex-wrap: wrap;
        }

        .toolbar-left,
        .toolbar-center,
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .toolbar-center {
          flex: 1 1 auto;
          justify-content: center;
          overflow: visible;
        }

        .toolbar-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px 8px;
          flex-wrap: nowrap;
          white-space: nowrap;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .toolbar-container::-webkit-scrollbar {
          display: none;
        }

        .toolbar-right {
          justify-content: flex-end;
        }

        .toolbar-center button {
          white-space: nowrap;
        }

        .toolbar-btn,
        .device-btn,
        .toolbar-icon {
          border-radius: 9999px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          background: rgba(248, 249, 251, 0.95);
          color: rgba(15, 23, 42, 0.9);
          font-weight: 500;
          font-size: 14px;
          transition: all 0.18s ease;
          cursor: pointer;
          position: relative;
          z-index: 5;
          mix-blend-mode: normal;
        }

        .toolbar-btn {
          padding: 6px 16px;
          line-height: 1.2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .device-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #f8f9fb;
          color: #111;
          border: 1px solid #ddd;
          border-radius: 9999px;
          padding: 6px 20px;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          min-width: 70px;
          height: auto;
          line-height: 1.2;
        }

        .toolbar-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          background: rgba(248, 249, 251, 0.92);
        }

        .toolbar-btn:hover,
        .device-btn:hover,
        .toolbar-icon:hover {
          background: var(--brand-highlight, rgba(224, 242, 254, 0.55));
          border-color: var(--brand-color, rgba(14, 165, 233, 0.8));
          color: var(--brand-color, #0ea5e9);
        }

        .toolbar-btn.active,
        .device-btn.active,
        .toolbar-btn[data-active='true'],
        .device-btn[data-active='true'] {
          background: var(--brand-color, #0ea5e9);
          border-color: var(--brand-color, #0ea5e9);
          color: #fff;
          font-weight: 600;
          box-shadow: 0 8px 20px rgba(14, 165, 233, 0.25);
        }

        .toolbar-btn:disabled,
        .device-btn:disabled,
        .toolbar-icon:disabled {
          cursor: not-allowed;
          opacity: 0.55;
          box-shadow: none;
        }

        .toolbar-icon.close {
          background: rgba(254, 242, 242, 0.95);
          border-color: rgba(248, 113, 113, 0.7);
          color: rgba(185, 28, 28, 0.9);
        }

        .toolbar-icon.close:hover {
          background: rgba(248, 113, 113, 1);
          border-color: rgba(220, 38, 38, 1);
          color: #fff;
        }

        .toolbar-zoom {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 9999px;
          background: rgba(248, 249, 251, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        .toolbar-zoom-level {
          min-width: 64px;
        }

        @media (max-width: 1024px) {
          .website-toolbar {
            justify-content: center;
          }

          .toolbar-left,
          .toolbar-right {
            flex: 1 1 100%;
            justify-content: center;
          }

          .toolbar-right {
            order: 3;
          }
        }

        @media (max-width: 768px) {
          .toolbar-container {
            position: sticky;
            top: calc(env(safe-area-inset-top, 0px));
            z-index: 1000;
            background: #fff;
            display: flex;
            gap: 8px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          }

          .toolbar-btn {
            padding: 6px 12px;
          }

          .device-btn {
            padding: 6px 16px;
          }
        }
      `}</style>
    </div>
  );
};

const createSection = (baseClass: string) => {
  return ({ children, className, ...rest }: ToolbarSectionProps) => (
    <div className={clsx(baseClass, className)} {...rest}>
      {children}
    </div>
  );
};

const ToolbarLeft = createSection("toolbar-left");
const ToolbarCenter = createSection("toolbar-center");
const ToolbarRight = createSection("toolbar-right");

const ToolbarContainer = ({ children, className, ...rest }: ToolbarSectionProps) => (
  <div className={clsx("toolbar-container", className)} {...rest}>
    {children}
  </div>
);

const ToolbarZoomGroup = ({ children, className, ...rest }: ToolbarSectionProps) => (
  <div className={clsx("toolbar-zoom", className)} {...rest}>
    {children}
  </div>
);

const ToolbarButton = ({ children, active = false, className, ...rest }: ToolbarButtonProps) => (
  <button
    type="button"
    className={clsx("toolbar-btn", className, active && "active")}
    data-active={active ? "true" : undefined}
    {...rest}
  >
    {children}
  </button>
);

const ToolbarDeviceButton = ({ children, active = false, className, ...rest }: ToolbarButtonProps) => (
  <button
    type="button"
    className={clsx("device-btn", className, active && "active")}
    data-active={active ? "true" : undefined}
    {...rest}
  >
    {children}
  </button>
);

const ToolbarIconButton = ({ children, className, ...rest }: ToolbarButtonProps) => (
  <button type="button" className={clsx("toolbar-icon", className)} {...rest}>
    {children}
  </button>
);

export const Toolbar = Object.assign(ToolbarRoot, {
  Left: ToolbarLeft,
  Center: ToolbarCenter,
  Right: ToolbarRight,
  Container: ToolbarContainer,
  Button: ToolbarButton,
  DeviceButton: ToolbarDeviceButton,
  IconButton: ToolbarIconButton,
  ZoomGroup: ToolbarZoomGroup,
});

export type { ToolbarProps };
