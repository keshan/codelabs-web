'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the structure of the environment data we expect
export interface Environment {
  id: string;
  user_id: string;
  codelab_id: string;
  container_id: string | null;
  status: 'PENDING' | 'RUNNING' | 'STOPPED' | 'ERROR' | null; // Allow null initial state
  connection_details: any | null;
  created_at: string;
  last_accessed_at: string;
}

interface EnvironmentContextType {
  environment: Environment | null;
  setEnvironment: React.Dispatch<React.SetStateAction<Environment | null>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const EnvironmentProvider = ({ children }: { children: ReactNode }) => {
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <EnvironmentContext.Provider 
      value={{ 
        environment, 
        setEnvironment, 
        isLoading, 
        setIsLoading, 
        error, 
        setError 
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = (): EnvironmentContextType => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
};
