/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTheme } from '../../Theme.tsx';
import { FluidProps } from '../../types.tsx';
import IridescentFluid from '../Core/IridescentFluid.tsx';

interface StageProps {
  fluidProps: FluidProps;
  clearTrigger: number;
}

const Stage: React.FC<StageProps> = ({ fluidProps, clearTrigger }) => {
  const { theme } = useTheme();

  // A premium abstract image to be displaced by the fluid
  const imageUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";

  return (
    <div style={{ 
        position: 'relative', 
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: theme.Color.Base.Surface[1],
        zIndex: 0
    }}>
        <IridescentFluid 
          config={fluidProps} 
          clearTrigger={clearTrigger} 
          imageUrl={imageUrl} 
        />
    </div>
  );
};

export default Stage;