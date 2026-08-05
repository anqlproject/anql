import React, { createContext, ReactNode, useCallback,useContext, useRef, useState } from 'react';

export interface MathEvaluationResult {
  result: string;
  error: string | null;
}

interface MathVariablesContextType {
  results: Record<string, MathEvaluationResult>;
  setResults: React.Dispatch<React.SetStateAction<Record<string, MathEvaluationResult>>>;
  
  // Local expressions tracking allows instant feedback while typing
  // without waiting for the 500ms debounce to Lexical EditorState
  localExpressions: Record<string, string>;
  setLocalExpression: (nodeKey: string, expression: string) => void;
}

const MathVariablesContext = createContext<MathVariablesContextType | undefined>(undefined);

export const MathVariablesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [results, setResults] = useState<Record<string, MathEvaluationResult>>({});
  const [localExpressions, setLocalExpressions] = useState<Record<string, string>>({});
  
  // We use a ref to prevent unnecessary re-renders when updating locally
  const localExpressionsRef = useRef<Record<string, string>>({});

  const setLocalExpression = useCallback((nodeKey: string, expression: string) => {
    localExpressionsRef.current = {
      ...localExpressionsRef.current,
      [nodeKey]: expression,
    };
    setLocalExpressions(localExpressionsRef.current);
  }, []);

  return (
    <MathVariablesContext.Provider value={{ results, setResults, localExpressions, setLocalExpression }}>
      {children}
    </MathVariablesContext.Provider>
  );
};

export const useMathVariables = (): MathVariablesContextType => {
  const context = useContext(MathVariablesContext);
  if (context === undefined) {
    throw new Error('useMathVariables must be used within a MathVariablesProvider');
  }
  return context;
};

export default MathVariablesContext;
