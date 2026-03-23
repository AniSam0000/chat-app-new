/* eslint-disable react-hooks/exhaustive-deps */

import { useContext, useEffect, useState } from "react";
import { ChatContext } from "./ChatContextProvider.js";
import { AuthContext } from "./AuthContextProvider.js";
import toast from "react-hot-toast";

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]); // Total users
  const [selectedUser, setSelectedUser] = useState(null); // The user selected for chatting and thier photos and profile
  const [unseenMessages, setUnseenMessages] = useState({}); // Store user id and number of unseen messages

  const { socket, axios } = useContext(AuthContext);

  // Function to get all users for sidebar
  const getUsers = async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users); // List off users to display on the left side bar
        setUnseenMessages(data.unseenMessages);
      }
    } catch (error) {
      toast.error(error.message);
      console.log(error.message);
    }
  };

  // Function to get messages of selected user
  const getMessages = async (userId) => {
    try {
      const { data } = await axios.get(`/api/messages/${userId}`);
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.log(error.message);
      toast.error(error.message);
    }
  };

  // Function to send message to a selected user
  const sendMessages = async (messageData) => {
    try {
      // Send a POST request to backend with messageData
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`, // recipient's ID in URL
        messageData, // body contains the actual message content
      );

      // If backend says success → update UI
      if (data.success) {
        setMessages((prevMessages) => [
          ...prevMessages,
          data.newMessage, // append new message from backend response
        ]);
      } else {
        // If backend responds with failure → show error toast
        toast.error(data.message);
      }
    } catch (error) {
      // If request itself fails → log and show toast
      console.log(error.message);
      toast.error(error.message);
    }
  };

  // Function to suscribe to messages  for selected user
  const suscribeToMessages = async () => {
    if (!socket) return; // Don't do anything if socket is not connected

    socket.on("newMessage", (newMessage) => {
      // Listen for "newMessage" events from server

      // If the message is from the currently selected chat user
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        newMessage.seen = true; // mark it as seen locally

        // Add this message to the chat window
        setMessages((prevMessages) => [...prevMessages, newMessage]);

        //  Tell backend that this message has been seen
        axios.put(`/api/messages/mark/${newMessage._id}`);
      }

      //  Otherwise, if the message is from another user
      else {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages, // keep existing unseen counts
          [newMessage.senderId]: prevUnseenMessages[newMessage.senderId]
            ? prevUnseenMessages[newMessage.senderId] + 1 // increment if exists
            : 1, // otherwise start count at 1
        }));
      }
    });
  };

  // Function to delete message
  const deleteMessage = async (messageId) => {
    setMessages((prev) => prev.filter((msg) => msg._id !== messageId));

    try {
      const response = await axios.delete(`/api/messages/${messageId}`);
      if (response.data.success) {
        toast.success("Message deleted");
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Function to unsuscribe from messages
  const unSuscribeFromMessages = () => {
    if (socket) socket.off("newMessage");
  };

  useEffect(() => {
    suscribeToMessages();
    return () => unSuscribeFromMessages();
  }, [socket, selectedUser, unseenMessages]);
  const value = {
    messages,
    users,
    selectedUser,
    getUsers,
    setMessages,
    sendMessages,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    getMessages,
    deleteMessage,
  };
  return <ChatContext value={value}>{children}</ChatContext>;
};
