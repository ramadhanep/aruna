import streamlit as st
import requests
import json

st.set_page_config(page_title="Aruna AI", layout="wide")
st.markdown(
        r"""
        <style>
        .stAppToolbar {
                visibility: hidden;
            }
        </style>
        """, unsafe_allow_html=True
    )

MODEL_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "deepseek-r1:14b"

def parse_streaming_response(raw_response):
    try:
        responses = []
        for line in raw_response.split("\n"):
            if line.strip():
                try:
                    json_obj = json.loads(line)
                    if "response" in json_obj:
                        responses.append(json_obj["response"])
                except json.JSONDecodeError:
                    continue
        return "".join(responses).strip()
    except Exception as e:
        return f"Error parsing streaming response: {e}"

def format_response(content):
    """
    Format response to display <think> tags as greyed-out text.
    """
    content = content.replace("<think>", "<span style='color:gray; font-style:italic;'>")
    content = content.replace("</think>", "</span>")
    return content

def send_message_to_model(message, history):
    try:
        payload = {
            "model": MODEL_NAME,
            "prompt": message,
            "history": history
        }
        response = requests.post(MODEL_URL, json=payload)
        response.raise_for_status()

        raw_response = response.text
        return parse_streaming_response(raw_response)
    except requests.exceptions.RequestException as e:
        return f"Error: Unable to connect to the model. Details: {e}"

def main():
    st.title("🤖 Aruna AI")
    
    if "history" not in st.session_state:
        st.session_state["history"] = [
            {"role": "bot", "content": "Hello! I am Aruna. How can I assist you today? 😊"}
        ]

    for chat in st.session_state["history"]:
        if chat["role"] == "user":
            with st.chat_message("user"):
                st.markdown(chat["content"])
        else:
            with st.chat_message("assistant"):
                formatted_content = format_response(chat["content"])
                st.markdown(formatted_content, unsafe_allow_html=True)

    user_input = st.chat_input("Type your message here...")
    if user_input:
        st.session_state["history"].append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        bot_response = send_message_to_model(user_input, st.session_state["history"])
        st.session_state["history"].append({"role": "bot", "content": bot_response})
        with st.chat_message("assistant"):
            formatted_response = format_response(bot_response)
            st.markdown(formatted_response, unsafe_allow_html=True)

if __name__ == "__main__":
    main()
