import { useState } from "react";
import { Header } from "@/components/Header";
import { AssessmentForm } from "@/components/AssessmentForm";
import { AssessmentResult } from "@/components/AssessmentResult";
import { AssessmentResult as AssessmentResultType } from "@/lib/api";

const AssessmentPage = () => {
  const [result, setResult] = useState<AssessmentResultType | null>(null);

  const handleAssessmentSuccess = (assessmentResult: AssessmentResultType) => {
    setResult(assessmentResult);
  };

  const handleNewAssessment = () => {
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-page px-6 pb-24 pt-12 lg:pt-16">
        {result ? (
          <AssessmentResult result={result} onNewAssessment={handleNewAssessment} />
        ) : (
          <div className="space-y-12">
            <div className="max-w-prose animate-fade-up">
              <p className="eyebrow mb-5">New assessment</p>
              <h1 className="text-[40px] sm:text-heading-lg">Start your assessment.</h1>
              <p className="mt-5 text-body text-slate">
                Get a complete rainwater harvesting feasibility analysis for your property, with
                recommendations, sizing and a cost breakdown.
              </p>
            </div>
            
            <AssessmentForm onSuccess={handleAssessmentSuccess} />
          </div>
        )}
      </main>
    </div>
  );
};

export default AssessmentPage;