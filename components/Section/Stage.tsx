
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { MotionValue } from 'framer-motion';
import { useTheme } from '../../Theme.tsx';
import { MetaButtonProps } from '../../types/index.tsx';
import IridescentFluid from '../Core/IridescentFluid.tsx';

interface StageProps {
  btnProps: any; // Kept to prevent breaking parent type check, but unused
  onButtonClick: () => void;
  showMeasurements: boolean;
  showTokens: boolean;
  view3D: boolean;
  viewRotateX: MotionValue<number>;
  viewRotateZ: MotionValue<number>;
  layerSpacing: MotionValue<number>;
}

const Stage: React.FC<StageProps> = ({ 
    // Props are destructured but unused as we are replacing the stage content entirely
    // This allows the parent component (MetaPrototype) to remain unchanged
    btnProps, 
    onButtonClick, 
    showMeasurements, 
    showTokens,
    view3D,
    viewRotateX,
    viewRotateZ,
    layerSpacing 
}) => {
  const { theme } = useTheme();

  return (
    <div style={{ 
        position: 'relative', 
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: theme.Color.Base.Surface[1],
        zIndex: 0
    }}>
        {/* 
            Replacing the component stage with the Iridescent Fluid Simulation.
            The previous Button component and overlays have been removed 
            to feature the full-screen interactive fluid.
        */}
        <IridescentFluid />
    </div>
  );
};

export default Stage;
