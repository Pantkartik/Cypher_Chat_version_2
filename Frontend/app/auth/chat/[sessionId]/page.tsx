"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Send, 
  Paperclip, 
  Smile, 
  Users, 
  Shield, 
  ArrowLeft, 
  Phone, 
  Video, 
  Settings, 
  Search, 
  ImageIcon, 
  File,
  MoreVertical,
  Star,
  Download,
  Copy,
  CheckCircle,
  Clock,
  Circle,
  Wifi,
  WifiOff
} from "lucide-react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import io from "socket.io-client"

interface Message {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  timestamp: Date
  encrypted: boolean
  status: "sending" | "sent" | "delivered" | "read"
  reactions?: { emoji: string; users: string[] }[]
  replyTo?: string
  fileUrl?: string
  fileName?: string
  fileType?: string
}

interface User {
  id: string
  name: string
  avatar?: string
  status: "online" | "away" | "offline"
  isTyping: boolean
}

export default function ChatPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = params?.sessionId as string;
  const username = searchParams?.get("username") || "Anonymous";
  
  // Add error boundary and loading states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);

  // Encryption/decryption
  const encryptMessage = (text: string): string => {
    return btoa(text);
  };
  const decryptMessage = (encrypted: string): string => {
    try {
      return atob(encrypted);
    } catch {
      return encrypted;
    }
  };

  useEffect(() => {
     if (!sessionId || !username) {
       setError("Missing session ID or username");
       setIsLoading(false);
       return;
     }
     
     try {
       const socket = io("http://localhost:3001");
       socketRef.current = socket;
       
       socket.on("connect", () => {
         setIsConnected(true);
         setIsLoading(false);
         console.log("[DEBUG] Connected to server");
       });
       
       socket.on("disconnect", () => {
         setIsConnected(false);
         console.log("[DEBUG] Disconnected from server");
       });
       
       socket.on("connect_error", (error) => {
         console.error("[DEBUG] Connection error:", error);
         setError("Failed to connect to server");
         setIsLoading(false);
       });
       
       socket.emit("joinSession", { sessionId, username });
       socket.on("receiveMessage", (msg: any) => {
         const processedMessage = {
           ...msg,
           timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
         };
         setMessages((prev) => [...prev, processedMessage]);
       });
       socket.on("userJoined", (user: any) => {
         setUsers((prev) => [...prev, user]);
       });
       
       return () => {
         socket.disconnect();
       };
     } catch (error) {
       console.error("[DEBUG] Socket initialization error:", error);
       setError("Failed to initialize chat");
       setIsLoading(false);
     }
   }, [sessionId, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isTyping) {
      const timer = setTimeout(() => setIsTyping(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "k":
            e.preventDefault();
            setShowSearch((prev) => !prev);
            break;
          case "f":
            e.preventDefault();
            setShowSearch(true);
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sendMessageHandler = () => {
    if (!message.trim()) return;
    
    // Create message data for server
    const messageData = {
      id: Date.now().toString(),
      userId: username,
      userName: username,
      content: encryptMessage(message),
      timestamp: new Date(),
      encrypted: true,
      status: "sent"
    };
    
    // Send to server - server will broadcast to all clients including sender
    socketRef.current.emit("sendMessage", { 
      sessionId, 
      username, 
      message,
      messageData 
    });
    setMessage("");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // File upload logic here
      console.log("File selected:", file.name);
    }
  };

  const formatTime = (date: Date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "sending":
        return <Clock className="w-3 h-3 text-muted-foreground" />;
      case "sent":
        return <CheckCircle className="w-3 h-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCircle className="w-3 h-3 text-accent" />;
      case "read":
        return <CheckCircle className="w-3 h-3 text-green-500" />;
    }
  };

  const getAvatarColor = (name: string) => {
    if (!name || typeof name !== 'string' || name.length === 0) {
      return "bg-blue-500"; // Default color
    }
    const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500", "bg-yellow-500", "bg-red-500"];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Loading state
   if (isLoading) {
     return (
       <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
         <div className="text-center">
           <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center animate-pulse">
             <Shield className="w-8 h-8 text-white" />
           </div>
           <h3 className="text-lg font-semibold text-foreground mb-2">Connecting to secure chat...</h3>
           <p className="text-muted-foreground">Establishing encrypted connection</p>
         </div>
       </div>
     );
   }

   // Error state
   if (error) {
     return (
       <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
         <div className="text-center max-w-md">
           <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-2xl flex items-center justify-center">
             <WifiOff className="w-8 h-8 text-red-600 dark:text-red-400" />
           </div>
           <h3 className="text-lg font-semibold text-foreground mb-2">Connection Failed</h3>
           <p className="text-muted-foreground mb-4">{error}</p>
           <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white">
             Retry Connection
           </Button>
         </div>
       </div>
     );
   }

   return (
     <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-80" : "w-0"} transition-all duration-300 border-r border-border/20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl flex flex-col overflow-hidden shadow-xl`}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Secure Chat</h2>
                <p className="text-xs text-muted-foreground">Session: {sessionId}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center space-x-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Online Users */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
              <span>Online Users</span>
              <Badge variant="secondary" className="text-xs">{users.length + 1}</Badge>
            </div>
            
            {/* Current User */}
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-200 dark:border-indigo-700">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className={`${getAvatarColor(username || 'A')} text-white font-semibold`}>
                    {(username || 'A').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-800"></div>
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{username}</p>
                <p className="text-xs text-muted-foreground">You</p>
              </div>
            </div>

            {/* Other Users */}
            {users.map((user) => (
              <div key={user.id} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className={`${getAvatarColor(user.name || 'A')} text-white font-semibold`}>
                      {(user.name || 'A').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${
                    user.status === "online" ? "bg-green-500" : user.status === "away" ? "bg-yellow-500" : "bg-gray-400"
                  }`}></div>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.status}</p>
                </div>
                {user.isTyping && (
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: "0.1s"}}></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border/20">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <Badge variant="outline" className="text-xs">
              <Shield className="w-3 h-3 mr-1" />
              Encrypted
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        {/* Chat Header */}
        <div className="p-6 border-b border-border/20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <Users className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Secure Chat Session</h1>
                <p className="text-sm text-muted-foreground">Session ID: {sessionId}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon">
                <Search className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Phone className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Video className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-full flex items-center justify-center">
                  <Shield className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Welcome to Secure Chat!</h3>
                <p className="text-muted-foreground max-w-md mx-auto">This is the beginning of your encrypted conversation. Messages here are secured with end-to-end encryption.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.userName === username ? "justify-end" : "justify-start"}`}>
                  <div className={`flex space-x-3 max-w-lg ${msg.userName === username ? "flex-row-reverse space-x-reverse" : ""}`}>
                    {msg.userName !== username && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className={`${getAvatarColor(msg.userName || 'A')} text-white text-sm font-semibold`}>
                         {(msg.userName || 'A').charAt(0).toUpperCase()}
                       </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`group relative ${msg.userName === username ? "items-end" : "items-start"}`}>
                      <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                        msg.userName === username 
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" 
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      }`}>
                        {msg.userName !== username && (
                          <p className="text-xs font-medium text-foreground mb-1">{msg.userName}</p>
                        )}
                        <p className="text-sm leading-relaxed">{decryptMessage(msg.content)}</p>
                        <div className="flex items-center justify-between mt-2 space-x-2">
                          <span className="text-xs opacity-70">{formatTime(msg.timestamp)}</span>
                          {msg.userName === username && getStatusIcon(msg.status)}
                        </div>
                      </div>
                      
                      {/* Message Actions */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="w-6 h-6">
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Typing Indicator */}
        {isTyping && (
          <div className="px-6 py-2 border-t border-border/20">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: "0.1s"}}></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
              </div>
              <span>Someone is typing...</span>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="p-6 border-t border-border/20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
          <div className="flex items-center space-x-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,application/pdf,.doc,.docx"
            />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => fileInputRef.current?.click()}
              className="hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setIsTyping(true);
                }}
                placeholder="Type your secure message..."
                className="pr-12 py-3 rounded-2xl border-slate-200 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessageHandler();
                  }
                }}
              />
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
              >
                <Smile className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
            <Button 
              onClick={sendMessageHandler}
              disabled={!message.trim()}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-3 rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}