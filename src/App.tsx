import { useEffect } from 'react';
import { Stage } from './scene/Stage';
import { Interface } from './ui/Interface';
import { startRuntime } from './runtime';
import { useExhibitAudio } from './audio';
export default function App() {
  useEffect(startRuntime,[]);
  useExhibitAudio();
  return <main className="exhibit"><Stage/><div className="vignette"/><Interface/></main>;
}
