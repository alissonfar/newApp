// src/pages/Insights/Insights.js
import React from 'react';
import PageHeader from '../../components/shared/PageHeader';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import './Insights.css';

const Insights = () => {
  return (
    <div className="insights-page">
      <PageHeader icon={<LightbulbIcon />} title="Insights" subtitle="Esta funcionalidade está em desenvolvimento." />
    </div>
  );
};

export default Insights;
