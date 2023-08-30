import './App.css';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Video from 'pages/Video';
import { ChakraProvider } from '@chakra-ui/react';

export default function App() {
  return (
    <ChakraProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Video />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}
