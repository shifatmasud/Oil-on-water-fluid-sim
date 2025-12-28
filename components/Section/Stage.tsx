
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTheme } from '../../Theme.tsx';
import { FluidProps } from '../../types/index.tsx';
import IridescentFluid from '../Core/IridescentFluid.tsx';

interface StageProps {
  fluidProps: FluidProps;
  clearTrigger: number;
}

const Stage: React.FC<StageProps> = ({ fluidProps, clearTrigger }) => {
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
        <IridescentFluid config={fluidProps} clearTrigger={clearTrigger} />
    </div>
  );
};

export default Stage;