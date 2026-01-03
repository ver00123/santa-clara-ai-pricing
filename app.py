from flask import Flask, render_template, request, jsonify
import joblib
import pandas as pd
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
rf_path = os.path.join(BASE_DIR, "santa_clara_airbnb_randon_forest_model_final.pkl")
xgb_path = os.path.join(BASE_DIR, "santa_clara_airbnb_xgb_model_final.pkl")

rf_model = joblib.load(rf_path)
xgb_model = joblib.load(xgb_path)

rf_features = rf_model.feature_names_in_
xgb_features = xgb_model.feature_names_in_

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        rf_df = pd.DataFrame(0, index=[0], columns=rf_features)
        xgb_df = pd.DataFrame(0, index=[0], columns=xgb_features)

        for df in [rf_df, xgb_df]:
            df['accommodates'] = int(data.get('acc', 0))
            df['bedrooms'] = int(data.get('bed', 0))
            
            if 'bathrooms_count' in df.columns: 
                df['bathrooms_count'] = float(data.get('bath', 1))
            if 'amenities_count' in df.columns: 
                df['amenities_count'] = int(data.get('amenities', 15))
            if 'available' in df.columns: 
                df['available'] = 1

        nh_col = f"neighbourhood_cleansed_{data.get('neighborhood')}"
        rt_col = f"room_type_{data.get('room_type')}"

        for df in [rf_df, xgb_df]:
            if nh_col in df.columns: df[nh_col] = 1
            if rt_col in df.columns: df[rt_col] = 1

        rf_p = rf_model.predict(rf_df)[0]
        xgb_p = xgb_model.predict(xgb_df)[0]
        final_price = (rf_p + xgb_p) / 2
        
        return jsonify({
            'success': True,
            'price': f"{final_price:.2f}",
            'rf': f"{rf_p:.2f}",
            'xgb': f"{xgb_p:.2f}"
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)