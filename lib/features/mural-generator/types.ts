// Type definitions for Mural Generator

export interface ReferenceMural {
  id: string;
  collectionName: string;
  designName: string;
  colorVariant: string | null;
  localFilePath: string;
  fileName: string;
  metadata: string | null;
  importedAt: Date;
}

export interface GeneratedMural {
  id: string;
  referenceMuralId: string;
  prompt: string;
  isCustomPrompt: boolean;
  localFilePath: string;
  fileName: string;
  modelUsed: string | null;
  generationParams: string | null;
  createdAt: Date;
}

export interface GenerationRequest {
  referenceMuralId: string;
  prompt: string;
  isCustomPrompt: boolean;
}

export interface PromptAnalysisResult {
  suggestedPrompt: string;
  styleElements: {
    subjects?: string[];
    technique?: string;
    colorPalette?: string[];
    composition?: string;
  };
}
