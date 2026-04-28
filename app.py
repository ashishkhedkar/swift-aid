import streamlit as st

st.set_page_config(page_title="SwiftAid", layout="wide")

st.title("SwiftAid")
st.subheader("AI-Powered Real-Time Ambulance Routing System")

st.markdown("### Features")
st.write("- Dynamic Routing (Dijkstra)")
st.write("- Traffic Signal Pre-emption")
st.write("- Real-time Simulation")

st.markdown("### Demo")
st.write("Backend simulation is running separately.")

st.success("System Ready!")