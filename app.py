from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import uuid
import json
import os
import random

app = Flask(__name__, static_folder='static')
CORS(app)

# Simple in-memory storage (use a real DB like SQLite/PostgreSQL for production)
trips = {}
responses = {}

# Mock AI destination suggestions
DESTINATIONS = {
    "beach": ["Bali, Indonesia", "Santorini, Greece", "Maldives", "Phuket, Thailand", "Amalfi Coast, Italy"],
    "mountain": ["Swiss Alps, Switzerland", "Himalayas, Nepal", "Dolomites, Italy", "Patagonia, Argentina", "Rocky Mountains, USA"],
    "city": ["Tokyo, Japan", "Paris, France", "New York, USA", "Barcelona, Spain", "Istanbul, Turkey"],
    "adventure": ["New Zealand", "Costa Rica", "Iceland", "Peru", "South Africa"],
    "culture": ["Kyoto, Japan", "Marrakech, Morocco", "Rome, Italy", "Cairo, Egypt", "Varanasi, India"],
    "default": ["Lisbon, Portugal", "Vienna, Austria", "Seoul, South Korea", "Amsterdam, Netherlands", "Buenos Aires, Argentina"]
}

def suggest_destinations(group_responses):
    """Simple AI-like destination suggestion based on group preferences."""
    score = {}
    
    for resp in group_responses:
        vibe = resp.get("vibe", "default").lower()
        for dest in DESTINATIONS.get(vibe, DESTINATIONS["default"]):
            score[dest] = score.get(dest, 0) + 1

    if not score:
        return random.sample(DESTINATIONS["default"], 3)

    sorted_dest = sorted(score.items(), key=lambda x: x[1], reverse=True)
    top = [d[0] for d in sorted_dest[:3]]
    
    while len(top) < 3:
        fallback = random.choice(DESTINATIONS["default"])
        if fallback not in top:
            top.append(fallback)
    
    return top

# ─── ROUTES ─────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/trip/<trip_id>')
def trip_page(trip_id):
    return send_from_directory('static', 'index.html')

@app.route('/api/trips', methods=['POST'])
def create_trip():
    data = request.json
    trip_id = str(uuid.uuid4())[:8]
    trips[trip_id] = {
        "id": trip_id,
        "name": data.get("name", "Our Trip"),
        "creator": data.get("creator", "Anonymous"),
        "responses": [],
        "suggestions": [],
        "votes": {},
        "status": "collecting"  # collecting → suggested → voted
    }
    responses[trip_id] = []
    return jsonify({"trip_id": trip_id, "link": f"/trip/{trip_id}"})

@app.route('/api/trips/<trip_id>', methods=['GET'])
def get_trip(trip_id):
    trip = trips.get(trip_id)
    if not trip:
        return jsonify({"error": "Trip not found"}), 404
    trip_data = dict(trip)
    trip_data["response_count"] = len(responses.get(trip_id, []))
    return jsonify(trip_data)

@app.route('/api/trips/<trip_id>/respond', methods=['POST'])
def submit_response(trip_id):
    if trip_id not in trips:
        return jsonify({"error": "Trip not found"}), 404
    
    data = request.json
    resp = {
        "name": data.get("name", "Anonymous"),
        "budget": data.get("budget", "medium"),
        "vibe": data.get("vibe", "city"),
        "duration": data.get("duration", "1week"),
        "notes": data.get("notes", "")
    }
    responses[trip_id].append(resp)
    trips[trip_id]["responses"].append(resp)
    
    return jsonify({"success": True, "message": "Response saved!"})

@app.route('/api/trips/<trip_id>/suggest', methods=['POST'])
def get_suggestions(trip_id):
    if trip_id not in trips:
        return jsonify({"error": "Trip not found"}), 404
    
    group_responses = responses.get(trip_id, [])
    suggestions = suggest_destinations(group_responses)
    
    trips[trip_id]["suggestions"] = suggestions
    trips[trip_id]["status"] = "suggested"
    trips[trip_id]["votes"] = {dest: [] for dest in suggestions}
    
    return jsonify({"suggestions": suggestions})

@app.route('/api/trips/<trip_id>/vote', methods=['POST'])
def cast_vote(trip_id):
    if trip_id not in trips:
        return jsonify({"error": "Trip not found"}), 404
    
    data = request.json
    destination = data.get("destination")
    voter = data.get("voter", "Anonymous")
    
    trip = trips[trip_id]
    if destination not in trip.get("votes", {}):
        return jsonify({"error": "Invalid destination"}), 400
    
    # Remove previous vote by this voter
    for dest in trip["votes"]:
        if voter in trip["votes"][dest]:
            trip["votes"][dest].remove(voter)
    
    trip["votes"][destination].append(voter)
    trip["status"] = "voted"
    
    return jsonify({"success": True, "votes": trip["votes"]})

@app.route('/api/trips/<trip_id>/results', methods=['GET'])
def get_results(trip_id):
    if trip_id not in trips:
        return jsonify({"error": "Trip not found"}), 404
    
    trip = trips[trip_id]
    votes = trip.get("votes", {})
    vote_counts = {dest: len(voters) for dest, voters in votes.items()}
    winner = max(vote_counts, key=vote_counts.get) if vote_counts else None
    
    return jsonify({
        "suggestions": trip.get("suggestions", []),
        "votes": vote_counts,
        "winner": winner,
        "status": trip["status"]
    })

if __name__ == '__main__':
    os.makedirs('static', exist_ok=True)
    app.run(debug=True, port=5000)
