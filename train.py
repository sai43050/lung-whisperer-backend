import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
from model import LungWhispererModel

X = np.random.randn(200,1,40,260)
y = np.random.randint(0,5,200)

dataset = TensorDataset(torch.tensor(X, dtype=torch.float32),
                        torch.tensor(y, dtype=torch.long))

loader = DataLoader(dataset, batch_size=16, shuffle=True)

model = LungWhispererModel()
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.0001)

for epoch in range(20):
    total_loss = 0
    for data, target in loader:
        optimizer.zero_grad()
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    print(f"Epoch {epoch+1}, Loss: {total_loss}")

torch.save(model.state_dict(), "model.pth")
print("Training Complete")
