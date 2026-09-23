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
      </Routes>
      <Footer />
    </>
  );
}
