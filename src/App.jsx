import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import PostRequest from './pages/PostRequest.jsx';
import Board from './pages/Board.jsx';
import RequestDetail from './pages/RequestDetail.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/post" element={<PostRequest />} />
        <Route path="/board" element={<Board />} />
        <Route path="/request/:id" element={<RequestDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/Admin" element={<AdminDashboard />} />
        <Route path="/Admin/*" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/escrow-admin" element={<AdminDashboard />} />
      </Routes>
      <Footer />
    </>
  );
}
