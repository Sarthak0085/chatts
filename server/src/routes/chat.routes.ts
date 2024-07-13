import { Router } from "express";
import { isAuthenticated } from "../middlewares/auth";
import { addMemberValidator, chatIdValidator, newGroupValidator, removeMemberValidator, renameValidator, sendAttachmentsValidator, validateHandler } from "../lib/validators";
import { addMembers, getChatDetails, getMessages, getMyArchievedChats, getMyBlockedChats, getMyChats, getMyGroups, getMyMutedChats, getMyPinnedChats, leaveGroup, newGroupChat, removeMember, renameGroup, sendAttachments, toggleArchiveChat, toggleBlockedChat, toggleMutedChat, togglePinChat } from "../controllers/chat.controller";
import { attachmentsMulter } from "../middlewares/multer";

const chatRouter = Router();

chatRouter.use(isAuthenticated);

chatRouter.post("/new", newGroupValidator(), validateHandler, newGroupChat);

chatRouter.get("/mychats", getMyChats);

chatRouter.get("/my/groups", getMyGroups);

chatRouter.get("/mypinchats", getMyPinnedChats);

chatRouter.get("/myblockChats", getMyBlockedChats);

chatRouter.get("/myarchievechats", getMyArchievedChats);

chatRouter.get("/mymutechats", getMyMutedChats);

chatRouter.put("/addmembers", addMemberValidator(), validateHandler, addMembers);

chatRouter.put("/pin/:id", chatIdValidator(), validateHandler, togglePinChat);

chatRouter.put("/archieve/:id", chatIdValidator(), validateHandler, toggleArchiveChat);

chatRouter.put("/mute/:id", chatIdValidator(), validateHandler, toggleMutedChat);

chatRouter.put("/block/:id", chatIdValidator(), validateHandler, toggleBlockedChat);

chatRouter.put(
    "/removemember",
    removeMemberValidator(),
    validateHandler,
    removeMember
);

chatRouter.delete("/leave/:id", chatIdValidator(), validateHandler, leaveGroup);

// Send Attachments
chatRouter.post(
    "/message",
    attachmentsMulter,
    sendAttachmentsValidator(),
    validateHandler,
    sendAttachments
);

// // Get Messages
chatRouter.get("/message/:id", chatIdValidator(), validateHandler, getMessages);

// // Get Chat Details, rename,delete
chatRouter.route("/:id")
    .get(chatIdValidator(), validateHandler, getChatDetails)
    .put(renameValidator(), validateHandler, renameGroup)
// .delete(chatIdValidator(), validateHandler, deleteChat);


export default chatRouter;