/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTheme } from '../../Theme.tsx';
import { FluidProps } from '../../types/index.tsx';
import RangeSlider from '../Core/RangeSlider.tsx';
import Button from '../Core/Button.tsx';

interface ControlPanelProps {
  fluidProps: FluidProps;
  onPropChange: (key: keyof FluidProps, value: any) => void;
  onClear: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  fluidProps, 
  onPropChange,
  onClear
}) => {
  const { theme } = useTheme();
  
  // Helper for mapping float values to integer slider ranges
  const createFloatSliderProps = (key: keyof FluidProps, min: number, max: number, power: number = 10000) => ({
    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
    motionValue: { get: () => fluidProps[key] * power, set: (v: number) => {}, onChange: () => {} } as any,
    onCommit: (value: number) => onPropChange(key, value / power),
    min: min * power,
    max: max * power,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing['Space.L'] }}>
      
      <RangeSlider {...createFloatSliderProps('velocityDissipation', 0.98, 0.9999)} />
      <RangeSlider {...createFloatSliderProps('densityDissipation', 0.98, 0.9999)} />

      <div style={{ borderTop: `1px solid ${theme.Color.Base.Surface[3]}` }} />

      <RangeSlider
        label="Pressure Iterations"
        motionValue={{ get: () => fluidProps.pressureIterations, set: () => {}, onChange: () => {} } as any}
        onCommit={(value) => onPropChange('pressureIterations', value)}
        min={5}
        max={40}
      />

      <div style={{ borderTop: `1px solid ${theme.Color.Base.Surface[3]}` }} />

      <RangeSlider {...createFloatSliderProps('splatRadius', 0.0001, 0.01)} />
      
      <RangeSlider
        label="Splat Strength"
        motionValue={{ get: () => fluidProps.splatStrength, set: () => {}, onChange: () => {} } as any}
        onCommit={(value) => onPropChange('splatStrength', value)}
        min={1}
        max={50}
      />
      
      <div style={{ borderTop: `1px solid ${theme.Color.Base.Surface[3]}` }} />
      
      <Button
        label="Clear Simulation"
        onClick={onClear}
        variant="secondary"
        size="M"
        icon="ph-wind"
      />
    </div>
  );
};

export default ControlPanel;