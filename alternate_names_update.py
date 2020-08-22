import pandas as pd
import json

df = pd.read_csv('WebsiteSearchDictionary.csv')

alternate_names_dict = dict()
for index, row in df.iterrows():
    if row['alternateNames'] == row['alternateNames']:
        alternate_names = row['alternateNames'].split(';')
        alternate_names_cleaned = []
        for name in alternate_names:
            if len(name) != 0:
                alternate_names_cleaned.append(name)
        alternate_names_dict[row['NodeName_Harmonized']] = alternate_names_cleaned

networks = json.load(open('networks.json', 'r'))
max_i = 0
for node in networks['elements']['nodes']:
    node_name = node['data']['name']
    if not node_name in alternate_names_dict:
        continue
    i = 0
    for name in alternate_names_dict[node_name]:
        node['data']['alternateName{}'.format(i)] = name
        i += 1
        max_i = max(max_i, i)

print(max_i)
json.dump(networks, open('networks_new.json', 'w'))