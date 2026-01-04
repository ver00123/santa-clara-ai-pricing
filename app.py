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

        is_weekend = int(data.get('is_weekend', 0))
        month = int(data.get('month', 1))
        is_available = int(data.get('available', 1))
        
        acc = abs(int(float(data.get('acc', 0))))
        bed = abs(int(float(data.get('bed', 0))))
        bath = abs(float(data.get('bath', 1)))
        amenities = abs(int(float(data.get('amenities', 15))))

        for df in [rf_df, xgb_df]:
            df['accommodates'] = acc
            df['bedrooms'] = bed
            if 'bathrooms_count' in df.columns: df['bathrooms_count'] = bath
            if 'amenities_count' in df.columns: df['amenities_count'] = amenities
            if 'available' in df.columns: df['available'] = is_available

        nh_col = f"neighbourhood_cleansed_{data.get('neighborhood')}"
        rt_col = f"room_type_{data.get('room_type')}"

        for df in [rf_df, xgb_df]:
            if nh_col in df.columns: df[nh_col] = 1
            if rt_col in df.columns: df[rt_col] = 1

        rf_p = rf_model.predict(rf_df)[0]
        xgb_raw = xgb_model.predict(xgb_df)[0]
        
        if xgb_raw > 450:
            market_tier = "Luxury Class"
        elif xgb_raw > 200:
            market_tier = "Standard Class"
        else:
            market_tier = "Economy Class"
        
        reasons = []
        multiplier = 1.0
        
        if month in [6, 7, 8, 12]:
            multiplier += 0.25 
            reasons.append("Peak Season demand in Santa Clara")
        elif month in [3, 4, 5, 9, 10]:
            multiplier += 0.10
            reasons.append("Moderate seasonal adjustment")
        else:
            multiplier += 0.05 

        if is_weekend == 1:
            multiplier += 0.15 
            reasons.append("Higher rates for weekend booking")
            
        if is_available == 0:
            multiplier -= 0.05 
            
        if market_tier == "Luxury Class":
            reasons.append("Premium property tier detected")

        final_price = ((rf_p + xgb_raw) / 2) * multiplier
        low_range = final_price * 0.90
        high_range = final_price * 1.10
        
        importances = rf_model.feature_importances_
        feat_imp_dict = dict(zip(rf_features, importances))

        impact_scores = {
            'Size': round(acc * feat_imp_dict.get('accommodates', 0.1) * 10, 2),    
            'Beds': round(bed * feat_imp_dict.get('bedrooms', 0.1) * 10, 2),    
            'Baths': round(bath * feat_imp_dict.get('bathrooms_count', 0.1) * 10, 2),   
            'Amenities': round(amenities * feat_imp_dict.get('amenities_count', 0.1) * 10, 2)
        }

        return jsonify({
            'success': True,
            'price': f"{final_price:.2f}",
            'range_low': f"{low_range:.2f}",
            'range_high': f"{high_range:.2f}",
            'rf': f"{rf_p:.2f}",
            'tier': market_tier,
            'impact': impact_scores,
            'insights': reasons
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)