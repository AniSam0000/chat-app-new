//Get all users except the logged in user

import cloudinary from "../lib/cloudinary.js";
import Message from "../models/Messages.js";
import User from "../models/user.js";
import { io, userSocketMap } from "../server.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password",
    );

    //Count number of messages not seen
    const unseenMessages = {};

    const promises = filteredUsers.map(async (user) => {
      const messages = await Message.countDocuments({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });
      // if (messages.length > 0) {
      //   unseenMessages[user._id] = messages.length;
      // }

      // Always store count (even 0)
      unseenMessages[user._id.toString()] = messages;
    });
    await Promise.all(promises);
    res.json({ success: true, users: filteredUsers, unseenMessages });
  } catch (error) {
    res.json({ success: false, message: error.message });
    console.log(error.message);
  }
};

// Get all messages for selected user
export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;

    const myId = req.user._id;

    const conversationId =
      myId < selectedUserId
        ? `${myId}_${selectedUserId}`
        : `${selectedUserId}_${myId}`;

    // const messages = await Message.find({
    //   $or: [
    //     { senderId: myId, receiverId: selectedUserId },
    //     { senderId: selectedUserId, receiverId: myId },
    //   ],
    // });

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean();

    await Message.updateMany(
      { senderId: selectedUserId, receiverId: myId },
      { seen: true },
    );

    res.json({ success: true, messages: messages });
  } catch (error) {
    res.json({ success: false, message: error.message });
    console.log(error.message);
  }
};

// api to mark message as seen using message id

export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.findByIdAndUpdate(id, { seen: true });
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
    console.log(error.message);
  }
};

// Send message to selected user
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;

    // Generate conversationId
    const conversationId =
      senderId.toString() < receiverId.toString()
        ? `${senderId}_${receiverId}`
        : `${receiverId}_${senderId}`;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      conversationId,
      senderId,
      receiverId,
      text,
      image: imageUrl || null,
    });

    //Emit the new message to the receiver socket
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("New Message", newMessage);
    }

    res.json({ success: true, newMessage });
  } catch (error) {
    res.json({ success: false, message: error.message });
    console.log(error.message);
  }
};

// Delete a single message
export const deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const user_id = req.user._id;

    const message = await Message.findById(messageId);

    if (message.senderId.toString() !== user_id.toString()) {
      res.status(403).json({ success: false, message: "User not authorized" });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false });
  }
};
