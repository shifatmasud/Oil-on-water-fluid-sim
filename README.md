# React 18 Meta Prototype & Design System Starter Kit

[**Remix on AI Studio**](https://ai.studio/apps/drive/1WYqqbd5DDER7bue4-jyHmwA6AC6Fn65w?fullscreenApplet=true)

This is a starter project for building modern, theme-aware React applications. It's set up with a modular structure, a powerful design system, and a configurable, interactive fluid simulation powered by Three.js.

## Project Scan Sheet

| Category | Details |
| :--- | :--- |
| **Framework** | React 18.2.0 (ESM via `importmap`) |
| **Rendering** | Three.js (WebGL) for core visual experience |
| **Styling** | CSS-in-JS (JS Objects), Semantic Design Tokens, No CSS Modules/Tailwind |
| **Animation** | Framer Motion 12.x (for UI), shaders (for simulation) |
| **Typography** | Bebas Neue (Display), Comic Neue (Quotes), Inter (UI), Victor Mono (Code) |
| **Icons** | Phosphor Icons (Web Component) |
| **State Management** | React Context (`Theme`, `Breakpoint`), Local State, History Stack (Undo/Redo) |
| **Architecture** | Atomic-based: `Core` → `Package` → `Section` → `Page` → `App` |
| **Key Components** | Floating Windows, Draggable Dock, State Layer (Ripple), Fluid Simulation Controls |
| **Theme System** | Light/Dark Modes, Responsive Tokens, Feedback States (Success, Warning, Error, Signal) |
| **Inputs** | Range Sliders, Toggles, Selects, TextAreas |
| **Visuals** | Interactive Iridescent Fluid Simulation |

## What's Inside? (ELI10 Version)

Imagine you're playing with a magical, colorful liquid on your screen. This project gives you a control panel to change how that liquid behaves.

-   **`index.html`**: The front door to our app.
-   **`index.tsx`**: The main brain of the app.
-   **`importmap.js`**: A map that tells our app where to find its tools (like React).
-   **`Theme.tsx`**: The "master closet" for our app's style (colors, fonts, etc.).
-   **`types.tsx`**: A central file for all TypeScript type definitions, like what a "Window" or "Log Entry" looks like.
-   **`hooks/`**: Special tools (custom hooks).
    -   `useBreakpoint.tsx`: Checks if you're on a phone, tablet, or desktop.
-   **`components/`**: The building blocks, organized by complexity!
    -   **`Core/`**: The most basic pieces (`IridescentFluid`, `RangeSlider`, `Toggle`).
    -   **`Package/`**: Combines Core pieces into something more useful (`ControlPanel`, `FloatingWindow`).
    -   **`Section/`**: A whole section of the app (the `Dock` at the bottom, the main `Stage`).
    -   **`Page/`**: A full screen you see (`Welcome` page).
    -   **`App/`**: The complete, running application (`MetaPrototype`).
-   **`README.md`**: This file! Your friendly guide.
-   **`LLM.md`**: Special instructions for AI helpers.
-   **`noteBook.md`**: A diary of tasks and progress.
-   **`bugReport.md`**: A list of bugs to fix.

## Directory Tree

```
.
├── components/
│   ├── App/
│   │   └── MetaPrototype.tsx
│   ├── Core/
│   │   ├── Button.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── Confetti.tsx
│   │   ├── DockIcon.tsx
│   │   ├── Input.tsx
│   │   ├── IridescentFluid.tsx
│   │   ├── LogEntry.tsx
│   │   ├── RangeSlider.tsx
│   │   ├── RippleLayer.tsx
│   │   ├── Select.tsx
│   │   ├── StateLayer.tsx
│   │   ├── TextArea.tsx
│   │   ├── ThemeToggleButton.tsx
│   │   └── Toggle.tsx
│   ├── Package/
│   │   ├── CodePanel.tsx
│   │   ├── ConsolePanel.tsx
│   │   ├── ControlPanel.tsx
│   │   ├── FloatingWindow.tsx
│   │   └── UndoRedo.tsx
│   ├── Page/
│   │   └── Welcome.tsx
│   └── Section/
│       ├── Dock.tsx
│       └── Stage.tsx
├── hooks/
│   └── useBreakpoint.tsx
├── README.md
├── LLM.md
├── noteBook.md
├── bugReport.md
├── Theme.tsx
├── types.tsx
├── importmap.js
├── index.html
├── index.tsx
├── metadata.json
```

## How to Get Started

1.  Open the `index.html` file in a modern web browser.
2.  That's it! The app will run.
3.  Use the dock icons to open the control panels and experiment with the fluid simulation.