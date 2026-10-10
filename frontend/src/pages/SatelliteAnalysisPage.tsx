import React from 'react';
import { Header } from '@/components/Header';
import SatelliteAnalysis from '@/components/SatelliteAnalysis';

const SatelliteAnalysisPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-page px-6 pb-24 pt-12 lg:pt-16">
        <SatelliteAnalysis />
      </main>
    </div>
  );
};

export default SatelliteAnalysisPage;
