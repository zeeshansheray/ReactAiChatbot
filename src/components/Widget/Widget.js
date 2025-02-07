import React, { useState, useEffect, useRef } from 'react';
import './widget.css';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello! How can I help you today?" },
  ]);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");

  const chatEndRef = useRef(null); // Ref to scroll to the last message

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async () => {
    if (userInput.trim() === "") return;

    // Add user's message to the chat
    const newMessages = [...messages, { from: "user", text: userInput }];
    setMessages(newMessages);
    setUserInput("");

    // Show typing indicator
    setLoading(true);

    try {
      // Send user's message to the backend
      const response = await fetch("http://127.0.0.1:5000/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ "query": userInput }),
      });

      const data = await response.json();

      console.log('data2 ', data);
      // Handle bot's response
      if (response.ok) {
        simulateTypingEffect(data.response); // Assuming the response has an `answer` field
      } else {
        simulateTypingEffect("Oops! Something went wrong. Please try again.");
      }
    } catch (error) {
      simulateTypingEffect("Oops! Unable to connect to the server. Please try again.");
    }
  };

  const simulateTypingEffect = (fullMessage) => {
    const interval = setInterval(() => {
      setMessages((prev) => [...prev, { from: "bot", text: fullMessage }]);
      setCurrentMessage("");
      setLoading(false);
      clearInterval(interval);
    }, 50);
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="chat-widget">
      <div className="chat-button" onClick={toggleChat}>
          <img src="https://one.aku.edu/Style%20Library/bootstrap-4.1.3/site/favicon.ico" height={28} />
      </div>

      {/* Chat Box */}
      {isOpen && (
        <div className="chat-box">
          <div className="chat-header">
            <img src="https://one.aku.edu/Style%20Library/AKUGlobalPortalHTMLSources/v9/images/OneAKU_white_logo.png" height={40} width={"auto"}/>
          </div>
          <div className="chat-body">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${msg.from === "user" ? "user" : "bot"}`}
              >
                {msg.text}
              </div>
            ))}

            {/* Typing Indicator */}
            {loading && (
              <div className="bot">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            {/* The ref will scroll us to this point */}
            <div ref={chatEndRef}></div>
          </div>
          <div className="chat-footer">
            <div className="chat-input-wrapper">
              <input
                type="text"
                placeholder="Enter message"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="chat-input"
              />
              <button onClick={handleSendMessage} className="send-button" style={{color: '#052049'}}>
                &#10148;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
