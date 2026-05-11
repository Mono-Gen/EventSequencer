import { useState } from 'react';
import { DeviceConfig, TrackConfig, Event } from '@/lib/types';

const STORAGE_KEY_LAST_PROJECT = 'sequencer_last_project';

interface ProjectData {
  devices: DeviceConfig[];
  tracks: TrackConfig[];
  events: Event[];
  loopRange: { start: number, end: number } | null;
  isLooping: boolean;
}

interface UseProjectPersistenceProps {
  onDataLoaded: (data: ProjectData) => void;
}

export function useProjectPersistence({ onDataLoaded }: UseProjectPersistenceProps) {
  const [projectName, setProjectName] = useState<string>("default");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'loading' | 'loaded'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoadProject = async (name: string, isQuick: boolean = false) => {
    setSaveStatus('loading');
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/project?name=${encodeURIComponent(name)}`);
      const result = await res.json();
      if (result.success && result.data) {
        setProjectName(name);
        localStorage.setItem(STORAGE_KEY_LAST_PROJECT, name);
        onDataLoaded(result.data);
        setSaveStatus(isQuick ? 'loaded' : 'idle');
        if (isQuick) setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
        setErrorMessage(result.error || 'Failed to load project');
      }
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage(`Failed to load project: ${name}`);
    }
  };

  const handleSaveProject = async (name: string, data: ProjectData) => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data }),
      });
      const result = await res.json();
      if (result.success) {
        setProjectName(name);
        localStorage.setItem(STORAGE_KEY_LAST_PROJECT, name);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setErrorMessage(result.error || 'Unknown save error');
      }
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage('Network error during save');
    }
  };

  return {
    projectName,
    setProjectName,
    saveStatus,
    setSaveStatus,
    errorMessage,
    setErrorMessage,
    handleLoadProject,
    handleSaveProject
  };
}
