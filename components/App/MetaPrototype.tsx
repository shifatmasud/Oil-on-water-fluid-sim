/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTheme } from '../../Theme.tsx';
import ThemeToggleButton from '../Core/ThemeToggleButton.tsx';
import FloatingWindow from '../Package/FloatingWindow.tsx';
import Dock from '../Section/Dock.tsx';
import Stage from '../Section/Stage.tsx';
import ControlPanel from '../Package/ControlPanel.tsx';
import CodePanel from '../Package/CodePanel.tsx';
import ConsolePanel from '../Package/ConsolePanel.tsx';
import UndoRedo from '../Package/UndoRedo.tsx';
import { WindowId, WindowState, LogEntry, FluidProps } from '../../types.tsx';

/**
 * 🏎️ Meta Prototype App
 * Acts as the main state orchestrator for the application.
 */
const MetaPrototype = () => {
  const { theme } = useTheme();
  
  // -- App State --
  const [fluidProps, setFluidProps] = useState<FluidProps>({
    velocityDissipation: 0.9964,
    densityDissipation: 0.99,
    pressureIterations: 24,
    splatRadius: 0.0052,
    splatStrength: 6,
  });
  
  // Simulation control state
  const [clearTrigger, setClearTrigger] = useState(0);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // -- History State --
  const [history, setHistory] = useState<FluidProps[]>([]);
  const [future, setFuture] = useState<FluidProps[]>([]);

  // --- Window Management ---
  const WINDOW_WIDTH = 400;
  const CONTROL_PANEL_HEIGHT = 480;
  const CODE_PANEL_HEIGHT = 408;
  const CONSOLE_PANEL_HEIGHT = 200;

  const [windows, setWindows] = useState<Record<WindowId, WindowState>>({
    control: { id: 'control', title: 'Control', isOpen: false, zIndex: 1, x: -WINDOW_WIDTH / 2, y: -CONTROL_PANEL_HEIGHT / 2 },
    code: { id: 'code', title: 'Code I/O', isOpen: false, zIndex: 2, x: -WINDOW_WIDTH / 2, y: -CODE_PANEL_HEIGHT / 2 },
    console: { id: 'console', title: 'Console', isOpen: false, zIndex: 3, x: -WINDOW_WIDTH / 2, y: -CONSOLE_PANEL_HEIGHT / 2 },
  });

  // -- Code Editor State --
  const [codeText, setCodeText] = useState('');
  const [isCodeFocused, setIsCodeFocused] = useState(false);
  
  useEffect(() => {
    if (!isCodeFocused) {
      setCodeText(JSON.stringify(fluidProps, null, 2));
    }
  }, [fluidProps, isCodeFocused]);

  // -- Actions --

  const logEvent = (msg: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message: msg,
    };
    setLogs(prev => [...prev, entry].slice(-50));
  };
  
  useEffect(() => {
      logEvent('System Ready. Fluid simulation initialized.');
  }, []);

  const updateFluidProps = (newProps: FluidProps, saveHistory: boolean = true) => {
    if (saveHistory) {
      setHistory(prev => [...prev, fluidProps]);
      setFuture([]);
    }
    setFluidProps(newProps);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setFuture(prev => [fluidProps, ...prev]);
    setFluidProps(previous);
    setHistory(newHistory);
    logEvent('Undo performed');
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setHistory(prev => [...prev, fluidProps]);
    setFluidProps(next);
    setFuture(newFuture);
    logEvent('Redo performed');
  };

  const bringToFront = (id: WindowId) => {
    setWindows(prev => {
      const maxZ = Math.max(...Object.values(prev).map((w: WindowState) => w.zIndex));
      if (prev[id].zIndex === maxZ) return prev;
      return { ...prev, [id]: { ...prev[id], zIndex: maxZ + 1 } };
    });
  };

  const toggleWindow = (id: WindowId) => {
    setWindows(prev => {
      const isOpen = !prev[id].isOpen;
      const next = { ...prev, [id]: { ...prev[id], isOpen } };
      if (isOpen) {
        const maxZ = Math.max(...Object.values(prev).map((w: WindowState) => w.zIndex));
        next[id].zIndex = maxZ + 1;
      }
      return next;
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(JSON.stringify(fluidProps, null, 2));
    logEvent('JSON copied to clipboard');
  };
  
  const handlePropChange = (key: keyof FluidProps, value: any) => {
      updateFluidProps({ ...fluidProps, [key]: value });
      logEvent(`Prop updated: ${key} = ${value}`);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setCodeText(newVal);
    try {
      const parsed = JSON.parse(newVal);
      updateFluidProps(parsed, true);
    } catch (err) {
      // Invalid JSON, just update text
    }
  };

  const handleClear = () => {
    setClearTrigger(t => t + 1);
    logEvent('Simulation cleared.');
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: theme.Color.Base.Surface[1],
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <ThemeToggleButton />
      
      <Stage fluidProps={fluidProps} clearTrigger={clearTrigger} />

      {/* --- WINDOWS --- */}
      <AnimatePresence>
        {windows.control.isOpen && (
          <FloatingWindow
            key="control"
            {...windows.control}
            onClose={() => toggleWindow('control')}
            onFocus={() => bringToFront('control')}
            footer={<UndoRedo onUndo={handleUndo} onRedo={handleRedo} canUndo={history.length > 0} canRedo={future.length > 0} />}
          >
            <ControlPanel
                fluidProps={fluidProps}
                onPropChange={handlePropChange}
                onClear={handleClear}
            />
          </FloatingWindow>
        )}

        {windows.code.isOpen && (
          <FloatingWindow
            key="code"
            {...windows.code}
            onClose={() => toggleWindow('code')}
            onFocus={() => bringToFront('code')}
          >
            <CodePanel
              codeText={codeText}
              onCodeChange={handleCodeChange}
              onCopyCode={handleCopyCode}
              onFocus={() => setIsCodeFocused(true)}
              onBlur={() => setIsCodeFocused(false)}
              fluidProps={fluidProps}
            />
          </FloatingWindow>
        )}

        {windows.console.isOpen && (
          <FloatingWindow
            key="console"
            {...windows.console}
            onClose={() => toggleWindow('console')}
            onFocus={() => bringToFront('console')}
          >
            <ConsolePanel logs={logs} />
          </FloatingWindow>
        )}
      </AnimatePresence>

      <Dock windows={windows} toggleWindow={toggleWindow} />
    </div>
  );
};

export default MetaPrototype;