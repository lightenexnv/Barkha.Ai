// src/components/SatelliteAnalysis.tsx
import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, AlertTriangle, CheckCircle, Info, Navigation } from 'lucide-react';
import { api, API_BASE_URL } from '@/lib/api';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RainfallData {
  monthly: number[];
  annual: number;
  source: string;
}

interface HarvestPotential {
  annual_harvest_liters: number;
  annual_harvest_cubic_meters: number;
  daily_average_liters: number;
  monthly_harvest_liters: number[];
  efficiency_factor: number;
  roof_area_used: number;
  annual_rainfall_mm: number;
}

interface AnalysisResult {
  success: boolean;
  roof_area: number;
  rainfall_data: RainfallData;
  harvest_potential: HarvestPotential;
  coordinates: Coordinates;
  processing_timestamp: string;
  error?: string;
  cv2_images?: {
    red_mask_path: string;
    contour_analysis_path: string;
  };
}

interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

const SatelliteAnalysis: React.FC = () => {
  // State management
  const [coordinates, setCoordinates] = useState<Coordinates>({ latitude: 28.7041, longitude: 77.1025 });
  const [satelliteImageUrl, setSatelliteImageUrl] = useState<string | null>(null);
  const [markedImageFile, setMarkedImageFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('coordinates');

  // Processing steps
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'coordinates', name: 'Enter Coordinates', status: 'pending' },
    { id: 'satellite', name: 'Fetch Satellite Image', status: 'pending' },
    { id: 'marking', name: 'Mark Rooftop', status: 'pending' },
    { id: 'analysis', name: 'Analyze Rooftop', status: 'pending' },
    { id: 'results', name: 'View Results', status: 'pending' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateStepStatus = (stepId: string, status: ProcessingStep['status'], message?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message } : step
    ));
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentStep('Getting your current location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ latitude, longitude });
        setLoading(false);
        setCurrentStep('Location obtained successfully!');
        updateStepStatus('coordinates', 'completed');
      },
      (error) => {
        setLoading(false);
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setError(errorMessage);
        setCurrentStep('');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleCoordinatesSubmit = async () => {
    if (!coordinates.latitude || !coordinates.longitude) {
      setError('Please enter valid coordinates');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentStep('Fetching satellite image...');
    setProgress(20);
    
    updateStepStatus('coordinates', 'completed');
    updateStepStatus('satellite', 'processing');

    try {
      const blob = await api.getSatelliteImage(coordinates.latitude, coordinates.longitude);
      const imageUrl = URL.createObjectURL(blob);
      setSatelliteImageUrl(imageUrl);
      
      updateStepStatus('satellite', 'completed');
      updateStepStatus('marking', 'pending');
      setActiveTab('marking');
      setProgress(40);
      setCurrentStep('Satellite image ready. Please mark your rooftop.');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch satellite image';
      setError(errorMsg);
      updateStepStatus('satellite', 'error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setMarkedImageFile(file);
        updateStepStatus('marking', 'completed');
        setError(null);
      } else {
        setError('Please select a valid image file');
      }
    }
  };

  const handleAnalysis = async () => {
    if (!markedImageFile) {
      setError('Please upload a marked image first');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentStep('Analyzing rooftop...');
    setProgress(60);
    
    updateStepStatus('analysis', 'processing');

    try {
      const data = await api.analyzeRooftop(coordinates.latitude, coordinates.longitude, markedImageFile);
      
      console.log('Analysis response:', data); // Debug logging
      
      // Check if the response has the expected structure
      if (data && typeof data === 'object') {
        // Transform the response to match the expected interface
        const transformedResult: AnalysisResult = {
          success: data.status === 'success' || data.success === true,
          roof_area: data.roof_area_sqm || data.roof_area || 0,
          rainfall_data: data.rainfall_data || { monthly: [], annual: 0, source: 'unknown' },
          harvest_potential: data.harvest_potential || {
            annual_harvest_liters: 0,
            annual_harvest_cubic_meters: 0,
            daily_average_liters: 0,
            monthly_harvest_liters: [],
            efficiency_factor: 0.8,
            roof_area_used: data.roof_area_sqm || data.roof_area || 0,
            annual_rainfall_mm: data.rainfall_data?.annual || 0
          },
          coordinates: { latitude: coordinates.latitude, longitude: coordinates.longitude },
          processing_timestamp: data.processing_timestamp || new Date().toISOString(),
          error: data.error || undefined,
          cv2_images: data.cv2_images || undefined
        };
        
        if (transformedResult.success) {
          setAnalysisResult(transformedResult);
          updateStepStatus('analysis', 'completed');
          updateStepStatus('results', 'completed');
          setActiveTab('results');
          setProgress(100);
          setCurrentStep('Analysis completed successfully!');
        } else {
          throw new Error(transformedResult.error || 'Analysis failed');
        }
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Analysis error:', err); // Debug logging
      const errorMsg = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMsg);
      updateStepStatus('analysis', 'error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setCoordinates({ latitude: 28.7041, longitude: 77.1025 });
    setSatelliteImageUrl(null);
    setMarkedImageFile(null);
    setAnalysisResult(null);
    setError(null);
    setProgress(0);
    setCurrentStep('');
    setActiveTab('coordinates');
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const, message: undefined })));
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSatelliteImage = () => {
    if (satelliteImageUrl) {
      const link = document.createElement('a');
      link.href = satelliteImageUrl;
      link.download = `satellite_${coordinates.latitude}_${coordinates.longitude}.png`;
      link.click();
    }
  };

  const downloadPdfReport = async () => {
    if (!analysisResult) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get assessment ID from the analysis result or generate one
      const assessmentId = `satellite_${coordinates.latitude}_${coordinates.longitude}_${Date.now()}`;
      
      const blob = await api.downloadPdfReport(assessmentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RTRWH_Assessment_${coordinates.latitude}_${coordinates.longitude}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF download failed:', error);
      setError('Failed to download PDF report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadTextReport = async () => {
    if (!analysisResult) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get assessment ID from the analysis result or generate one
      const assessmentId = `satellite_${coordinates.latitude}_${coordinates.longitude}_${Date.now()}`;
      
      const blob = await api.downloadTextReport(assessmentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RTRWH_Assessment_${coordinates.latitude}_${coordinates.longitude}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Text download failed:', error);
      setError('Failed to download text report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadBothReports = async () => {
    if (!analysisResult) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get assessment ID from the analysis result or generate one
      const assessmentId = `satellite_${coordinates.latitude}_${coordinates.longitude}_${Date.now()}`;
      
      const blob = await api.downloadBothReports(assessmentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RTRWH_Reports_${coordinates.latitude}_${coordinates.longitude}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Reports download failed:', error);
      setError('Failed to download reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="max-w-prose">
        <p className="eyebrow mb-5">Satellite analysis</p>
        <h1 className="text-[40px] sm:text-heading-lg">Measure your rooftop from above.</h1>
        <p className="mt-5 text-body text-slate">
          Calculate rainwater harvesting potential using satellite imagery of your building.
        </p>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progress} className="w-full" />
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center space-y-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-[13px] font-medium ${
                    step.status === 'completed' ? 'bg-foreground text-white' :
                    step.status === 'processing' ? 'border border-link bg-card text-foreground' :
                    step.status === 'error' ? 'bg-destructive/10 text-destructive' :
                    'border border-border bg-card text-muted-foreground'
                  }`}>
                    {step.status === 'completed' ? <CheckCircle className="w-4 h-4" /> :
                     step.status === 'error' ? <AlertTriangle className="w-4 h-4" /> :
                     index + 1}
                  </div>
                  <span className="text-xs text-center text-slate">{step.name}</span>
                  {step.message && (
                    <span className="text-xs text-muted-foreground text-center">{step.message}</span>
                  )}
                </div>
              ))}
            </div>
            {currentStep && (
              <div className="text-center text-sm text-muted-foreground">
                {currentStep}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="h-auto w-max gap-1 rounded-lg bg-secondary p-1">
            {[["coordinates", "Coordinates"], ["marking", "Mark rooftop"], ["analysis", "Analysis"], ["results", "Results"]].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="rounded-md px-3 py-1.5 font-normal data-[state=active]:font-medium data-[state=active]:shadow-subtle">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Step 1: Coordinates */}
        <TabsContent value="coordinates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Enter location coordinates</CardTitle>
              <CardDescription>
                Enter the latitude and longitude of your building location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    placeholder="e.g., 28.7041"
                    value={coordinates.latitude}
                    onChange={(e) => setCoordinates(prev => ({
                      ...prev,
                      latitude: parseFloat(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    placeholder="e.g., 77.1025"
                    value={coordinates.longitude}
                    onChange={(e) => setCoordinates(prev => ({
                      ...prev,
                      longitude: parseFloat(e.target.value) || 0
                    }))}
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={getCurrentLocation} 
                  disabled={loading}
                  variant="ghost"
                  className="flex-1"
                >
                  <Navigation className="w-4 h-4" />
                  {loading ? 'Getting Location...' : 'Use Current Location'}
                </Button>
                <Button 
                  onClick={handleCoordinatesSubmit} 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Fetching Satellite Image...' : 'Get Satellite Image'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 2: Mark Rooftop */}
        <TabsContent value="marking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Mark your rooftop</CardTitle>
              <CardDescription>
                Download the satellite image, mark your rooftop with red color, and upload it back
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {satelliteImageUrl ? (
                <>
                  <div className="space-y-4">
                    <div className="text-center">
                      <img 
                        src={satelliteImageUrl} 
                        alt="Satellite view" 
                        className="mx-auto h-auto max-w-full rounded-xl border border-border shadow-subtle"
                        style={{ maxHeight: '400px' }}
                      />
                    </div>
                    
                    <Button 
                      onClick={downloadSatelliteImage}
                      className="w-full"
                      variant="outline"
                    >
                      <Download className="w-4 h-4" />
                      Download Satellite Image
                    </Button>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Instructions:</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1">
                          <li>Download the satellite image above</li>
                          <li>Open it in any image editor (Paint, Photoshop, etc.)</li>
                          <li>Use RED color to outline your rooftop perimeter</li>
                          <li>Save the marked image</li>
                          <li>Upload it using the button below</li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="marked-image">Upload Marked Image</Label>
                      <Input
                        id="marked-image"
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                    </div>

                    {markedImageFile && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Marked image uploaded: {markedImageFile.name}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Please fetch the satellite image first by entering coordinates in the previous step.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 3: Analysis */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Analyze rooftop</CardTitle>
              <CardDescription>
                Process the marked image and calculate harvesting potential
              </CardDescription>
            </CardHeader>
            <CardContent>
              {markedImageFile ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Ready to analyze: {markedImageFile.name}
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    onClick={handleAnalysis} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Analyzing...' : 'Start Analysis'}
                  </Button>
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Please upload a marked image in the previous step before starting analysis.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 4: Results */}
        <TabsContent value="results" className="space-y-4">
          {analysisResult ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Analysis results</CardTitle>
                  <CardDescription>
                    Rooftop dimensions and rainwater harvesting potential
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border bg-muted p-5">
                      <div className="text-heading-sm font-extralight text-foreground tabular-nums">
                        {analysisResult.roof_area.toFixed(1)}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Roof Area (m²)</div>
                    </div>
                    
                    <div className="rounded-xl border border-border bg-muted p-5">
                      <div className="text-heading-sm font-extralight text-foreground tabular-nums">
                        {analysisResult.harvest_potential.annual_harvest_liters.toLocaleString()}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Annual Harvest (L)</div>
                    </div>
                    
                    <div className="rounded-xl border border-border bg-muted p-5">
                      <div className="text-heading-sm font-extralight text-foreground tabular-nums">
                        {analysisResult.harvest_potential.daily_average_liters}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Daily Average (L)</div>
                    </div>
                    
                    <div className="rounded-xl border border-border bg-muted p-5">
                      <div className="text-heading-sm font-extralight text-foreground tabular-nums">
                        {analysisResult.rainfall_data.annual.toFixed(0)}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Annual Rainfall (mm)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Monthly harvest potential</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {analysisResult.harvest_potential.monthly_harvest_liters.map((harvest, index) => (
                      <div key={index} className="rounded-lg border border-border bg-card p-3">
                        <div className="text-sm font-medium text-foreground tabular-nums">{harvest.toLocaleString()} L</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(0, index).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* CV2 Processed Images */}
              {analysisResult.cv2_images && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-medium">Image analysis results</CardTitle>
                    <CardDescription>
                      Computer vision analysis of your marked rooftop
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Red Mask Image */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Red Marking Detection</h4>
                        <div className="overflow-hidden rounded-xl border border-border bg-accent">
                          <img 
                            src={`${API_BASE_URL}/api/cv2-image/${analysisResult.cv2_images.red_mask_path}`}
                            alt="Red marking detection"
                            className="w-full h-auto"
                            onError={(e) => {
                              console.error('Failed to load red mask image:', e);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Shows detected red markings from your uploaded image
                        </p>
                      </div>

                      {/* Contour Analysis Image */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Roof Contour Analysis</h4>
                        <div className="overflow-hidden rounded-xl border border-border bg-accent">
                          <img 
                            src={`${API_BASE_URL}/api/cv2-image/${analysisResult.cv2_images.contour_analysis_path}`}
                            alt="Roof contour analysis"
                            className="w-full h-auto"
                            onError={(e) => {
                              console.error('Failed to load contour analysis image:', e);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Shows detected roof perimeter and calculated area
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Download Reports Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Download reports</CardTitle>
                  <CardDescription>
                    Download your analysis results in PDF, TXT, or both formats
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      onClick={downloadPdfReport}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </Button>
                    
                    <Button 
                      onClick={downloadTextReport}
                      disabled={loading}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download TXT
                    </Button>
                    
                    <Button 
                      onClick={downloadBothReports}
                      disabled={loading}
                      variant="ghost"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Both (ZIP)
                    </Button>
                  </div>
                  
                  {loading && (
                    <div className="mt-4 text-center">
                      <div className="text-sm text-muted-foreground">Generating reports...</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="text-center">
                <Button onClick={resetAnalysis} variant="ghost">
                  Start New Analysis
                </Button>
              </div>
            </>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Complete the analysis in the previous step to view results.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SatelliteAnalysis;