// Обработчик открытия формы
// Form open handler
&НаКлиенте
Procedure OnOpen(Cancel)
		// Открыть браузер с 1CHarness UI
			// Open browser with 1CHarness UI
				RunSystem("xdg-open file:///workspace/index.html?demo=1 &");
				
					// Показать сообщение
						// Show message
							Message("1CHarness UI: file:///workspace/index.html?demo=1");
							EndProcedure