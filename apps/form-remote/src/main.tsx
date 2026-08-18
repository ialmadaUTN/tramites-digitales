import React from 'react';
import { createRoot } from 'react-dom/client';
import { DynamicForm } from './DynamicForm';
import './styles.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<DynamicForm formId="11111111-1111-4111-8111-111111111111" apiBaseUrl="http://localhost:3001/api/v1" />);
