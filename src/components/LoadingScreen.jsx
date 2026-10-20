import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <h1 className="game-title">Runa Mania</h1>
        
        <div className="loading-bar-container">
          <div className="loading-bar"></div>
        </div>
        
        <p className="loading-text">Invocando runas...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;